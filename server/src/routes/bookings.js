import express from "express";
import { pool } from "../db.js";
import { badRequest } from "../utils.js";

export const bookingsRouter = express.Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Accepts HH:MM or HH:MM:SS for Postgres TIME */
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

/**
 * One round-trip insert: avoids explicit BEGIN/COMMIT on a dedicated client, which can fail
 * or misbehave with some Supabase pooler / PgBouncer setups when each query must use the pool.
 */
async function tryInsertBookingAtomic({
  userId,
  room_id,
  date,
  startNorm,
  endNorm,
  meeting_name,
}) {
  const sql = `
    insert into bookings (user_id, room_id, date, start_time, end_time, meeting_name, status)
    select $1::bigint, $2::bigint, $3::date, $4::time, $5::time, $6, 'confirmed'
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

// POST /api/bookings — instant confirmation
bookingsRouter.post("/", async (req, res) => {
  const { roomId, date, startTime, endTime, meetingName } = req.body ?? {};
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
  if (!Number.isFinite(userId) || userId <= 0) return badRequest(res, "Invalid session user");

  const meeting_name =
    typeof meetingName === "string" && meetingName.trim().length > 0
      ? meetingName.trim()
      : null;

  try {
    const booking = await tryInsertBookingAtomic({
      userId,
      room_id,
      date,
      startNorm,
      endNorm,
      meeting_name,
    });
    if (booking) {
      return res.status(201).json({ booking });
    }

    const room = await pool.query("select 1 from rooms where id = $1", [room_id]);
    if (!room.rowCount) return res.status(404).json({ error: "Room not found" });
    return res.status(409).json({
      error: "This time slot is already taken. Please choose another time.",
      code: "BOOKING_CONFLICT",
    });
  } catch (e) {
    const code = e?.code;
    const msg = String(e?.message || "");
    const constraint = e?.constraint;

    // eslint-disable-next-line no-console
    console.error("BOOKING_INSERT_FAILED", {
      pgCode: code,
      constraint,
      message: msg,
      detail: e?.detail,
    });

    const includeDebug =
      process.env.NODE_ENV !== "production" || process.env.BOOKING_DEBUG === "1";
    const debugPayload = includeDebug
      ? { pgCode: code, constraint, message: msg, detail: e?.detail }
      : undefined;

    if (code === "23514" && (constraint === "chk_booking_time_order" || msg.includes("chk_booking_time_order"))) {
      return badRequest(res, "startTime must be before endTime");
    }
    if (
      code === "23514" ||
      /violates check constraint/i.test(msg) ||
      msg.includes("23514")
    ) {
      return res.status(500).json({
        error:
          "Database rejected this booking. If you recently deployed, open the Supabase SQL Editor and run the script in server/supabase_bookings_status_migration.sql (it updates the bookings status check to allow 'confirmed').",
        code: "BOOKING_DB_CHECK",
        ...(debugPayload && { debug: debugPayload }),
      });
    }
    if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
      return res.status(500).json({
        error:
          "Database permission denied. If you use Supabase, disable RLS on `bookings` or add policies that allow authenticated inserts for your API role.",
        code: "BOOKING_RLS",
        ...(debugPayload && { debug: debugPayload }),
      });
    }
    if (code === "23503") {
      return res.status(500).json({
        error: "Invalid user or room (database foreign key). Try logging out and back in.",
        code: "BOOKING_FK",
        ...(debugPayload && { debug: debugPayload }),
      });
    }

    return res.status(500).json({
      error: "Could not save your booking. Please try again.",
      ...(debugPayload && { debug: debugPayload }),
    });
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

    // Check if booking has already ended
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

// Calendar helper — returns confirmed bookings for a room/week
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

// Keep old name as alias so calendar.js still works
export const getApprovedBookingsForRoomWeek = getConfirmedBookingsForRoomWeek;
