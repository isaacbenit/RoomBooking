import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../db.js";
import { badRequest, isValidEmail } from "../utils.js";

export const adminRouter = express.Router();

const DOMAIN = "@testsolutions.de";
const FIRST_ADMIN_EMAIL = "isaac.benit@testsolutions.de";

function isCompanyEmail(email) {
  return (
    isValidEmail(email) && String(email).toLowerCase().endsWith(DOMAIN)
  );
}

async function adminCount() {
  const { rows } = await pool.query(
    "select count(*)::int as count from users where role = 'Admin'"
  );
  return rows[0]?.count ?? 0;
}

function makeTempPassword() {
  // readable, WhatsApp-friendly
  return crypto.randomBytes(9).toString("base64url"); // ~12 chars
}

// Registration requests
adminRouter.get("/registration-requests", async (req, res) => {
  const status = String(req.query.status || "pending");
  if (!["pending", "rejected", "approved"].includes(status)) {
    return badRequest(res, "Invalid status filter");
  }

  try {
    const { rows } = await pool.query(
      `select id, full_name, email, reason, status, created_at
       from registration_requests
       where status = $1
       order by created_at desc`,
      [status]
    );
    return res.json({ requests: rows });
  } catch {
    return res.status(500).json({ error: "Failed to fetch registration requests" });
  }
});

adminRouter.patch("/registration-requests/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid request id");

  try {
    const { rows } = await pool.query(
      "select * from registration_requests where id = $1",
      [id]
    );
    const rr = rows[0];
    if (!rr) return res.status(404).json({ error: "Request not found" });
    if (rr.status !== "pending")
      return res.status(400).json({ error: "Only pending requests can be approved" });

    const email = String(rr.email).toLowerCase();
    if (!isCompanyEmail(email)) {
      return res.status(400).json({ error: "Use your organization email." });
    }

    // Ensure user doesn't already exist
    const existing = await pool.query("select 1 from users where email = $1", [email]);
    if (existing.rowCount) {
      await pool.query(
        "update registration_requests set status = 'approved' where id = $1",
        [id]
      );
      return res.json({ ok: true, temporaryPassword: null, note: "User already existed." });
    }

    const tempPassword = makeTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await pool.query("begin");
    await pool.query(
      `insert into users (full_name, email, password_hash, role)
       values ($1, $2, $3, 'Employee')`,
      [rr.full_name, email, passwordHash]
    );
    await pool.query(
      "update registration_requests set status = 'approved' where id = $1",
      [id]
    );
    await pool.query("commit");

    return res.json({ ok: true, temporaryPassword: tempPassword });
  } catch (e) {
    try {
      await pool.query("rollback");
    } catch {}
    if (e?.code === "23505") {
      return res.status(409).json({ error: "User or request already exists" });
    }
    return res.status(500).json({ error: "Failed to approve request" });
  }
});

adminRouter.patch("/registration-requests/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid request id");
  try {
    const { rowCount } = await pool.query(
      "update registration_requests set status = 'rejected' where id = $1 and status = 'pending'",
      [id]
    );
    if (!rowCount) {
      return res
        .status(400)
        .json({ error: "Only pending requests can be rejected" });
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to reject request" });
  }
});

// Manage users
adminRouter.get("/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "select id, full_name, email, role, created_at from users order by created_at desc"
    );
    return res.json({ users: rows, firstAdminEmail: FIRST_ADMIN_EMAIL, adminCap: 5 });
  } catch {
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminRouter.patch("/users/:id/role", async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body ?? {};
  if (!Number.isFinite(id)) return badRequest(res, "Invalid user id");
  if (role !== "Admin" && role !== "Employee") return badRequest(res, "Invalid role");

  try {
    const { rows } = await pool.query(
      "select id, email, role from users where id = $1",
      [id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    if (role === "Admin" && user.role !== "Admin") {
      const count = await adminCount();
      if (count >= 5) {
        return res.status(409).json({
          error:
            "Admin limit reached (5/5). Demote an existing admin first before promoting a new one.",
          code: "ADMIN_LIMIT",
        });
      }
    }

    const updated = await pool.query(
      "update users set role = $1 where id = $2 returning id, full_name, email, role, created_at",
      [role, id]
    );
    return res.json({ user: updated.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to update user role" });
  }
});

