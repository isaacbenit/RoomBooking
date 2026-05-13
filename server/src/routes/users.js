import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import { badRequest } from "../utils.js";
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
export const usersRouter = express.Router();

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
    // 1. Get the current hash
    const { rows } = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. Compare current password
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // 3. Hash new password and Update
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    const updateResult = await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [hashedNewPassword, req.user.id]
    );

    // Check if the update actually happened
    if (updateResult.rowCount === 0) {
      return res.status(500).json({ error: "Password was not updated. Please try again." });
    }

    return res.json({ ok: true });

  } catch (err) {
    // Log the actual error to your terminal so you can see it!
    console.error("PASSWORD_UPDATE_ERROR:", err);
    return res.status(500).json({ error: "Server error during password update." });
  }
});
