import express from "express";
import { pool } from "../db.js";
import { badRequest, isValidEmail } from "../utils.js";
import { sendApprovalEmail } from "../email.js";

export const adminRouter = express.Router();

const DOMAIN = "@testsolutions.de";
const FIRST_ADMIN_EMAIL = "isaac.benit@testsolutions.de";

function isCompanyEmail(email) {
  return isValidEmail(email) && String(email).toLowerCase().endsWith(DOMAIN);
}

async function adminCount() {
  const { rows } = await pool.query(
    "select count(*)::int as count from users where role = 'Admin'"
  );
  return rows[0]?.count ?? 0;
}

// Registration requests — never select password_hash
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
    // Select password_hash here (server-side only — never sent to client)
    const { rows } = await pool.query(
      "select id, full_name, email, status, password_hash from registration_requests where id = $1",
      [id]
    );
    const rr = rows[0];
    if (!rr) return res.status(404).json({ error: "Request not found" });
    if (rr.status !== "pending")
      return res.status(400).json({ error: "Only pending requests can be approved" });

    const email = String(rr.email).toLowerCase();
    if (!isCompanyEmail(email)) {
      return res.status(400).json({ error: "Please use your company email to continue." });
    }

    if (!rr.password_hash) {
      return res.status(400).json({
        error: "This request has no password on file. Ask the user to re-submit their request.",
      });
    }

    // Ensure user doesn't already exist
    const existing = await pool.query("select 1 from users where email = $1", [email]);
    if (existing.rowCount) {
      await pool.query(
        "update registration_requests set status = 'approved' where id = $1",
        [id]
      );
      return res.json({ ok: true, note: "User already existed." });
    }

    // Use the password_hash the user set during registration — no temp password
    await pool.query("begin");
    await pool.query(
      `insert into users (full_name, email, password_hash, role)
       values ($1, $2, $3, 'Employee')`,
      [rr.full_name, email, rr.password_hash]
    );
    await pool.query(
      "update registration_requests set status = 'approved' where id = $1",
      [id]
    );
    await pool.query("commit");

    // Send approval email (non-blocking)
    fireApprovalEmail(email, rr.full_name);

    return res.json({ ok: true });
  } catch (e) {
    try { await pool.query("rollback"); } catch {}
    if (e?.code === "23505") {
      return res.status(409).json({ error: "User already exists" });
    }
    return res.status(500).json({ error: "Failed to approve request" });
  }
});

// Fire approval email after successful commit (non-blocking)
async function fireApprovalEmail(email, fullName) {
  try { await sendApprovalEmail({ to: email, fullName }); } catch {}
}

adminRouter.patch("/registration-requests/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid request id");
  try {
    const { rowCount } = await pool.query(
      "update registration_requests set status = 'rejected' where id = $1 and status = 'pending'",
      [id]
    );
    if (!rowCount) {
      return res.status(400).json({ error: "Only pending requests can be rejected" });
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to reject request" });
  }
});

// Manage users — never select password_hash
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
          error: "Admin limit reached (5/5). Demote an existing admin first before promoting a new one.",
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

// Delete user — admin cannot delete themselves or the seeded first admin
adminRouter.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid user id");

  // Prevent self-deletion
  if (Number(req.user.id) === id) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  try {
    const { rows } = await pool.query(
      "select id, email from users where id = $1",
      [id]
    );
    const target = rows[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    // Protect the seeded first admin
    if (String(target.email).toLowerCase() === FIRST_ADMIN_EMAIL) {
      return res.status(403).json({ error: "The primary admin account cannot be deleted." });
    }

    // Bookings are removed via ON DELETE CASCADE on the FK
    await pool.query("delete from users where id = $1", [id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete user" });
  }
});
