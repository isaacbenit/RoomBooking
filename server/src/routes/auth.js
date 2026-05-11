import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import { signToken } from "../auth.js";
import { badRequest, isValidEmail } from "../utils.js";

export const authRouter = express.Router();

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

authRouter.post("/register", async (req, res) => {
  const { fullName, email, password, role } = req.body ?? {};

  if (typeof fullName !== "string" || fullName.trim().length < 2)
    return badRequest(res, "Full name is required");
  if (!isValidEmail(email)) return badRequest(res, "Valid email is required");
  if (typeof password !== "string" || password.length < 8)
    return badRequest(res, "Password must be at least 8 characters");
  if (role !== "Admin" && role !== "Employee")
    return badRequest(res, "Role must be Admin or Employee");

  try {
    if (role === "Admin") {
      const count = await adminCount();
      if (count >= 5) {
        return res.status(403).json({
          error: "Admin registration cap reached (5). Please register as Employee.",
          code: "ADMIN_CAP_REACHED",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `insert into users (full_name, email, password_hash, role)
       values ($1, $2, $3, $4)
       returning id, full_name, email, role`,
      [fullName.trim(), email.toLowerCase(), passwordHash, role]
    );

    const user = rows[0];
    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (e) {
    // Helpful server-side log (shows up in the terminal running the server)
    // eslint-disable-next-line no-console
    console.error("REGISTER_FAILED", {
      code: e?.code,
      constraint: e?.constraint,
      message: e?.message,
      detail: e?.detail,
    });

    // Postgres unique violation (email)
    if (
      e?.code === "23505" &&
      (e?.constraint === "users_email_key" ||
        String(e?.message || "").toLowerCase().includes("users_email_key") ||
        String(e?.detail || "").toLowerCase().includes("email"))
    ) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Table missing => database.sql not executed
    if (e?.code === "42P01") {
      return res.status(500).json({
        error:
          "Database not initialized. Run server/database.sql in Supabase SQL Editor, then retry.",
        code: "DB_NOT_INITIALIZED",
      });
    }

    // Invalid password/auth/database issues (common on misconfigured DATABASE_URL)
    if (e?.code === "28P01") {
      return res.status(500).json({
        error:
          "Database auth failed. Check DATABASE_URL username/password and retry.",
        code: "DB_AUTH_FAILED",
      });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!isValidEmail(email)) return badRequest(res, "Valid email is required");
  if (typeof password !== "string" || password.length === 0)
    return badRequest(res, "Password is required");

  try {
    const { rows } = await pool.query(
      "select id, full_name, email, role, password_hash from users where email = $1",
      [email.toLowerCase()]
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: "Invalid email or password" });

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

