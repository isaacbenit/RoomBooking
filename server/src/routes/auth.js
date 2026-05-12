import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import { signToken } from "../auth.js";
import { badRequest, isValidEmail } from "../utils.js";

export const authRouter = express.Router();

const DOMAIN = "@testsolutions.de";

function isCompanyEmail(email) {
  return isValidEmail(email) && String(email).toLowerCase().endsWith(DOMAIN);
}

async function adminCount() {
  const { rows } = await pool.query(
    "select count(*)::int as count from users where role = 'Admin'"
  );
  return rows[0]?.count ?? 0;
}

authRouter.get("/admin-count", async (_req, res) => {
  try {
    const count = await adminCount();
    return res.json({ adminCount: count, adminCap: 5, canRegisterAdmin: count < 5 });
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch admin count" });
  }
});

authRouter.post("/register", (_req, res) => {
  return res.status(410).json({ error: "Registration is disabled. Use Request Access." });
});

authRouter.post("/request-access", async (req, res) => {
  const { fullName, email, reason } = req.body ?? {};
  if (typeof fullName !== "string" || fullName.trim().length < 2)
    return badRequest(res, "Full name is required");
  if (!isCompanyEmail(email))
    return badRequest(res, "Use your organization email.");

  const emailNorm = String(email).toLowerCase();
  const reasonNorm =
    typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : null;

  try {
    // If user already exists, let them know to login
    const existing = await pool.query("select 1 from users where email = $1", [emailNorm]);
    if (existing.rowCount) {
      return res.status(409).json({ error: "Account already exists. Please log in." });
    }

    // Upsert request: if previously rejected, let them re-request; set to pending again.
    await pool.query(
      `insert into registration_requests (full_name, email, reason, status)
       values ($1, $2, $3, 'pending')
       on conflict (email) do update
         set full_name = excluded.full_name,
             reason = excluded.reason,
             status = 'pending'`,
      [fullName.trim(), emailNorm, reasonNorm]
    );

    return res.status(201).json({
      ok: true,
      message:
        "Your request has been submitted. You will be able to log in once an administrator approves your account.",
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to submit request" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!isCompanyEmail(email))
    return badRequest(res, "Use your organization email.");
  if (typeof password !== "string" || password.length === 0)
    return badRequest(res, "Password is required");

  try {
    const { rows } = await pool.query(
      "select id, full_name, email, role, password_hash from users where email = $1",
      [email.toLowerCase()]
    );
    const row = rows[0];
    if (!row) {
      // Check request status
      const rr = await pool.query(
        "select status from registration_requests where email = $1",
        [String(email).toLowerCase()]
      );
      const status = rr.rows[0]?.status;
      if (status === "pending") {
        return res.status(403).json({
          error:
            "Your account is pending approval. Please contact your administrator.",
          code: "PENDING_APPROVAL",
        });
      }
      if (status === "rejected") {
        return res.status(403).json({
          error:
            "Your account request was not approved. Please contact your administrator.",
          code: "REJECTED",
        });
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const user = { id: row.id, full_name: row.full_name, email: row.email, role: row.role };
    const token = signToken(user);
    return res.json({ token, user });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("LOGIN_FAILED", {
      code: e?.code,
      constraint: e?.constraint,
      message: e?.message,
      detail: e?.detail,
    });

    if (e?.code === "42P01") {
      return res.status(500).json({
        error:
          "Database not initialized. Run server/database.sql in Supabase SQL Editor, then retry.",
        code: "DB_NOT_INITIALIZED",
      });
    }
    if (e?.code === "28P01") {
      return res.status(500).json({
        error:
          "Database auth failed. Check DATABASE_URL username/password and retry.",
        code: "DB_AUTH_FAILED",
      });
    }
    return res.status(500).json({ error: "Login failed" });
  }
});

