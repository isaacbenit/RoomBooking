import express from "express";
import { pool } from "../db.js";
import { badRequest } from "../utils.js";

export const bookingsRouter = express.Router();

function requireAdminInRouter(req, res, next) {
  if (req.user?.role !== "Admin")
    return res.status(403).json({ error: "Admin access required" });
  next();
}

function overlapWhereClause() {
  // Overlap if NOT (existing.end <= new.start OR existing.start >= new.end)
  return `not (b.end_time <= $3 or b.start_time >= $4)`;
}

async function hasApprovedConflict({ roomId, date, startTime, endTime, excludeId }) {
  const params = [roomId, date, startTime, endTime];
  let sql = `
    select 1
    from bookings b
    where b.room_id = $1
      and b.date = $2
      and b.status = 'approved'
      and ${overlapWhereClause()}
  `;

  if (excludeId) {
    params.push(excludeId);
    sql += " and b.id <> $5";
  }

  sql += " limit 1";

  const { rowCount } = await pool.query(sql, params);
  return rowCount > 0;
}

bookingsRouter.get("/", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    if (req.user.role === "Admin") {
      const { rows } = await pool.query(
        `select
           b.id, b.user_id, b.room_id, b.date::text as date, b.start_time, b.end_time, b.meeting_name,
           b.status, b.created_at,
           u.full_name as user_full_name,
           u.role as user_role,
           r.name as room_name
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
      `select
         b.id, b.user_id, b.room_id, b.date::text as date, b.start_time, b.end_time, b.meeting_name,
         b.status, b.created_at,
         r.name as room_name
       from bookings b
       join rooms r on r.id = b.room_id
       where b.user_id = $1
       order by b.created_at desc`,
      [req.user.id]
    );
    const sliced = rows.slice(offset, offset + limit);
    return res.json({
      bookings: sliced,
      limit,
      offset,
      hasMore: offset + limit < rows.length,
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

bookingsRouter.post("/", async (req, res) => {
  const { roomId, date, startTime, endTime, meetingName } = req.body ?? {};
  const room_id = Number(roomId);
  if (!Number.isFinite(room_id)) return badRequest(res, "Valid roomId is required");
  if (typeof date !== "string" || date.length < 8) return badRequest(res, "Valid date is required");
  if (typeof startTime !== "string" || typeof endTime !== "string")
    return badRequest(res, "Valid startTime and endTime are required");

  try {
    // Ensure room exists
    const room = await pool.query("select 1 from rooms where id = $1", [room_id]);
    if (!room.rowCount) return res.status(404).json({ error: "Room not found" });

    // Block double-bookings vs approved bookings
    const conflict = await hasApprovedConflict({
      roomId: room_id,
      date,
      startTime,
      endTime,
    });
    if (conflict) {
      return res.status(409).json({
        error: "This time overlaps an existing approved booking for that room.",
        code: "BOOKING_CONFLICT",
      });
    }

    const meeting_name =
      typeof meetingName === "string" && meetingName.trim().length > 0
        ? meetingName.trim()
        : null;

    const { rows } = await pool.query(
      `insert into bookings (user_id, room_id, date, start_time, end_time, meeting_name, status)
       values ($1, $2, $3, $4, $5, $6, 'pending')
       returning id, user_id, room_id, date, start_time, end_time, meeting_name, status, created_at`,
      [req.user.id, room_id, date, startTime, endTime, meeting_name]
    );
    return res.status(201).json({ booking: rows[0] });
  } catch (e) {
    if (String(e?.message || "").includes("chk_booking_time_order")) {
      return badRequest(res, "startTime must be before endTime");
    }
    return res.status(500).json({ error: "Failed to create booking request" });
  }
});

bookingsRouter.patch("/:id/approve", requireAdminInRouter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid booking id");

  try {
    const { rows } = await pool.query(
      "select * from bookings where id = $1",
      [id]
    );
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const conflict = await hasApprovedConflict({
      roomId: booking.room_id,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      excludeId: booking.id,
    });
    if (conflict) {
      return res.status(409).json({
        error: "Cannot approve: overlaps an existing approved booking for that room.",
        code: "BOOKING_CONFLICT",
      });
    }

    const updated = await pool.query(
      "update bookings set status = 'approved' where id = $1 returning *",
      [id]
    );
    return res.json({ booking: updated.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to approve booking" });
  }
});

bookingsRouter.patch("/:id/reject", requireAdminInRouter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid booking id");

  try {
    const updated = await pool.query(
      "update bookings set status = 'rejected' where id = $1 returning *",
      [id]
    );
    if (!updated.rowCount) return res.status(404).json({ error: "Booking not found" });
    return res.json({ booking: updated.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to reject booking" });
  }
});

bookingsRouter.patch("/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid booking id");

  try {
    const { rows } = await pool.query(
      "select id, user_id, status from bookings where id = $1",
      [id]
    );
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (Number(booking.user_id) !== Number(req.user.id))
      return res.status(403).json({ error: "You can only cancel your own requests" });
    if (booking.status !== "pending")
      return res.status(400).json({ error: "Only pending requests can be cancelled" });

    await pool.query("delete from bookings where id = $1", [id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export async function getApprovedBookingsForRoomWeek({ roomId, startDate, endDate }) {
  // inclusive range
  const { rows } = await pool.query(
    `select
       b.id, b.room_id, b.date::text as date, b.start_time, b.end_time, b.meeting_name,
       u.full_name as user_full_name
     from bookings b
     join users u on u.id = b.user_id
     where b.room_id = $1
       and b.status = 'approved'
       and b.date between $2 and $3
     order by b.date asc, b.start_time asc`,
    [roomId, startDate, endDate]
  );
  return rows;
}

