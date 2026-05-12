import express from "express";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import { pool } from "../db.js";
import { badRequest } from "../utils.js";

export const usersRouter = express.Router();

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  message: { error: "Too many password change attempts. Please try again in 15 minutes." },
});

// PATCH /api/users/me/name
usersRouter.patch("/me/name", async (req, res) => {
  const { fullName } = req.body ?? {};
  if (typeof fullName !== "string" || fullName.trim().length < 2)
    return badRequest(res, "Full name must be at least 2 characters.");

  try {
    const { rows } = await pool.query(
      "update users set full_name = $1 where id = $2 returning id, full_name, email, role, created_at",
      [fullName.trim(), req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    return res.json({ ok: true, user: rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to update name" });
  }
});

// PATCH /api/users/me/password
usersRouter.patch("/me/password", passwordChangeLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || currentPassword.length === 0)
    return badRequest(res, "Current password is required.");
  if (typeof newPassword !== "string" || newPassword.length < 6)
    return badRequest(res, "New password must be at least 6 characters.");
  if (currentPassword === newPassword)
    return badRequest(res, "New password cannot be the same as your current password.");

  try {
    const { rows } = await pool.query(
      "select password_hash from users where id = $1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: "Current password is incorrect." });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query("update users set password_hash = $1 where id = $2", [newHash, req.user.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to update password" });
  }
});
