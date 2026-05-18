import express from "express";
import { Resend } from "resend";
import { pool } from "../db.js";
import { badRequest } from "../utils.js";

export const bookingsRouter = express.Router();

// SAFE INITIALIZATION: Checks if key exists. If missing, it provides a fallback string
// so your server keeps running smoothly instead of crashing.
const apiKey = process.env.RESEND_API_KEY || "re_fallback_key_for_safety";
const resend = new Resend(apiKey);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMEish = /^\d{1,2}:\d{2}(:\d{2})?$/;

function normalizeTimeForPg(t) {
  const s = String(t || "").trim();
  if (!TIMEish.test(s)) return null;
  const parts = s.split(":");
  const h = String(Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0))).padStart(2, "0");
  const m = String(Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0))).padStart(2, "0");
  const sec = parts[2] != null ? String(Math.min(59, Math.max(0, parseInt(parts[2], 10) || 0))).padStart(2, "0") : "00";
  return `${h}:${m}:${sec}`;
}

function requireAdminInRouter(req, res, next) {
  if (req.user?.role !== "Admin")
    return res.status(403).json({ error: "Admin access required" });
  next();
}

function timeToMinutes(t) {
  const [h, m, s] = String(t).split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m + s / 60;
}

async function tryInsertBookingAtomic({
  userId,
  userRole,
  room_id,
  date,
  startNorm,
  endNorm,
  meeting_name,
}) {
  const targetStatus = userRole === "Admin" ? "confirmed" : "pending";

  const sql = `
    insert into bookings (user_id, room_id, date, start_time, end_time, meeting_name, status)
    select $1::bigint, $2::bigint, $3::date, $4::time, $5::time, $6, $7
    where exists (select 1 from rooms r where r.id = $2::bigint)
      and not exists (
        select 1 from bookings b
        where b.room_id = $2::bigint
          and b.date = $3::date
          and b.status = 'confirmed'
          and b.start_time < $5::time
          and b.end_time > $4::time
      )
    returning id, user_id, room_id, date::text as date,
      start_time::text as start_time, end_time::text as end_time,
      meeting_name, status, created_at
  `;
  const { rows } = await pool.query(sql, [
    userId,
    room_id,
    date,
    startNorm,
    endNorm,
    meeting_name,
    targetStatus,
  ]);
  return rows[0] ?? null;
}

// GET /api/bookings
bookingsRouter.get("/", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    if (req.user.role === "Admin") {
      const { rows } = await pool.query(
        `select b.id, b.user_id, b.room_id, b.date::text as date,
                b.start_time, b.end_time, b.meeting_name, b.status, b.created_at,
                u.full_name as user_full_name, u.role as user_role, r.name as room_name
         from bookings b
         join users u on u.id = b.user_id
         join rooms r on r.id = b.room_id
         order by b.created_at desc
         limit $1 offset $2`,
        [limit, offset]
      );
      return res.json({ bookings: rows, limit, offset, hasMore: rows.length === limit });
    }

    const { rows } = await pool.query(
      `select b.id, b.user_id, b.room_id, b.date::text as date,
              b.start_time, b.end_time, b.meeting_name, b.status, b.created_at,
              r.name as room_name
       from bookings b
       join rooms r on r.id = b.room_id
       where b.user_id = $1
       order by b.created_at desc`,
      [req.user.id]
    );
    const sliced = rows.slice(offset, offset + limit);
    return res.json({ bookings: sliced, limit, offset, hasMore: offset + limit < rows.length });
  } catch {
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// POST /api/bookings
bookingsRouter.post("/", async (req, res) => {
  const { roomId, date, startTime, endTime, meetingName, emailMessage } = req.body ?? {};
  const room_id = Number(roomId);
  if (!Number.isFinite(room_id)) return badRequest(res, "Valid roomId is required");
  if (typeof date !== "string" || !ISO_DATE.test(date)) return badRequest(res, "Valid date (YYYY-MM-DD) is required");

  const startNorm = typeof startTime === "string" ? normalizeTimeForPg(startTime) : null;
  const endNorm = typeof endTime === "string" ? normalizeTimeForPg(endTime) : null;
  if (!startNorm || !endNorm) return badRequest(res, "Valid startTime and endTime are required (HH:MM or HH:MM:SS)");

  if (timeToMinutes(endNorm) - timeToMinutes(startNorm) <= 0) {
    return badRequest(res, "End time must be after start time.");
  }
  if (timeToMinutes(endNorm) - timeToMinutes(startNorm) < 30) {
    return badRequest(res, "Booking must be at least 30 minutes long (e.g. 08:00–08:30).");
  }

  const userId = Number(req.user?.id);
  const userRole = req.user?.role;
  const userFullName = req.user?.full_name || "An employee";
  if (!Number.isFinite(userId) || userId <= 0) return badRequest(res, "Invalid session user");

  const meeting_name =
    typeof meetingName === "string" && meetingName.trim().length > 0
      ? meetingName.trim()
      : null;

  try {
    const booking = await tryInsertBookingAtomic({
      userId,
      userRole,
      room_id,
      date,
      startNorm,
      endNorm,
      meeting_name,
    });

    if (booking) {
      if (userRole !== "Admin") {
        try {
          const roomRes = await pool.query("select name from rooms where id = $1", [room_id]);
          const roomName = roomRes.rows[0]?.name || `Room #${room_id}`;

          const adminRes = await pool.query("select email from users where role = 'Admin'");
          const adminEmails = adminRes.rows.map((row) => row.email).filter(Boolean);

          if (adminEmails.length > 0) {
            const emailSubject = meeting_name
              ? `Booking Request: ${meeting_name}`
              : `New Room Reservation Request - ${roomName}`;

            const employeeNote = typeof emailMessage === "string" && emailMessage.trim().length > 0
              ? emailMessage.trim()
              : "No additional notes provided by applicant.";

            const htmlBody = `
              <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; color: #334155;">
                <h2 style="color: #d97706; margin-top: 0;">⏳ New Booking Request Pending Approval</h2>
                <p><strong>Applicant:</strong> ${userFullName}</p>
                <p><strong>Room Target:</strong> ${roomName}</p>
                <p><strong>Schedule:</strong> ${date} @ ${startNorm.slice(0, 5)} - ${endNorm.slice(0, 5)}</p>
                <p><strong>Meeting Context Title:</strong> ${meeting_name || "<em>Not Specified</em>"}</p>
                <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
                <p style="font-size: 11px; font-weight: bold; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Employee Notes & Comments</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px; font-style: italic; border-radius: 4px;">
                  "${employeeNote}"
                </div>
                <p style="margin-top: 25px; font-size: 13px; color: #64748b;">Please log in to the administrative panel to approve or decline this request slot.</p>
              </div>
            `;

            // Wrapped in an internal conditional check so missing keys don't interrupt db queries
            if (apiKey !== "re_fallback_key_for_safety") {
              resend.emails.send({
                from: "Room Reservation <bookings@testsolutions.de>",
                to: adminEmails,
                subject: emailSubject,
                html: htmlBody,
              }).catch(mailErr => {
                console.error("BACKGROUND_RESEND_DISPATCH_ERROR:", mailErr);
              });
            } else {
              console.warn("Skipping email dispatch: RESEND_API_KEY environment variable is missing.");
            }
          }
        } catch (emailFetchErr) {
          console.error("FAILED_TO_GATHER_EMAIL_METADATA:", emailFetchErr);
        }
      }

      return res.status(201).json({ booking });
    }

    const room = await pool.query("select 1 from rooms where id = $1", [room_id]);
    if (!room.rowCount) return res.status(404).json({ error: "Room not found" });
    return res.status(409).json({
      error: "This time slot conflicts with an already confirmed booking. Please choose another time.",
      code: "BOOKING_CONFLICT",
    });
  } catch (e) {
    console.error("BOOKING_INSERT_FAILED", e);
    return res.status(500).json({ error: "Could not save your booking request. Please try again." });
  }
});

// PATCH /api/bookings/:id/status — Admin approves or rejects requests
bookingsRouter.patch("/:id/status", requireAdminInRouter, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!Number.isFinite(id)) return badRequest(res, "Invalid booking id");
  if (!["confirmed", "rejected"].includes(status)) {
    return badRequest(res, "Invalid status. Must be confirmed or rejected.");
  }

  try {
    if (status === "confirmed") {
      const conflictCheck = await pool.query(
        `select 1 from bookings b
         join bookings target on target.id = $1
         where b.room_id = target.room_id
           and b.date = target.date
           and b.status = 'confirmed'
           and b.id != target.id
           and b.start_time < target.end_time
           and b.end_time > target.start_time`,
        [id]
      );
      if (conflictCheck.rowCount > 0) {
        return res.status(409).json({ error: "Cannot approve. This slot conflicts with another confirmed booking." });
      }
    }

    const { rows } = await pool.query(
      "update bookings set status = $1 where id = $2 returning *",
      [status, id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Booking not found" });
    return res.json({ booking: rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to update booking status" });
  }
});

// PATCH /:id/cancel — owner cancels their own booking (before it ends)
bookingsRouter.patch("/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid booking id");

  try {
    const { rows } = await pool.query(
      "select id, user_id, status, date::text as date, end_time::text as end_time from bookings where id = $1",
      [id]
    );
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const isOwner = Number(booking.user_id) === Number(req.user.id);
    const isAdmin = req.user.role === "Admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ error: "You can only cancel your own bookings" });

    const now = new Date();
    const bookingEnd = new Date(`${booking.date}T${booking.end_time}`);
    if (!isAdmin && now > bookingEnd)
      return res.status(400).json({ error: "Cannot cancel a booking that has already ended" });

    await pool.query("delete from bookings where id = $1", [id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// DELETE /:id — admin hard-deletes any booking
bookingsRouter.delete("/:id", requireAdminInRouter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid booking id");
  try {
    const { rowCount } = await pool.query("delete from bookings where id = $1", [id]);
    if (!rowCount) return res.status(404).json({ error: "Booking not found" });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete booking" });
  }
});

export async function getConfirmedBookingsForRoomWeek({ roomId, startDate, endDate }) {
  const { rows } = await pool.query(
    `select b.id, b.user_id, b.room_id, b.date::text as date,
            b.start_time::text as start_time, b.end_time::text as end_time, b.meeting_name,
            u.full_name as user_full_name
     from bookings b
     join users u on u.id = b.user_id
     where b.room_id = $1
       and b.status = 'confirmed'
       and b.date between $2 and $3
     order by b.date asc, b.start_time asc`,
    [roomId, startDate, endDate]
  );
  return rows;
}

export const getApprovedBookingsForRoomWeek = getConfirmedBookingsForRoomWeek;