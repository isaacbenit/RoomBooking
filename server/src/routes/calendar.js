import express from "express";
import { badRequest } from "../utils.js";
import { getApprovedBookingsForRoomWeek } from "./bookings.js";

export const calendarRouter = express.Router();

// GET /api/calendar/room/:roomId/week?start=YYYY-MM-DD
calendarRouter.get("/room/:roomId/week", async (req, res) => {
  const roomId = Number(req.params.roomId);
  const { start } = req.query ?? {};
  if (!Number.isFinite(roomId)) return badRequest(res, "Invalid roomId");
  if (typeof start !== "string" || start.length !== 10)
    return badRequest(res, "Query param 'start' must be YYYY-MM-DD");

  const startDate = start;
  const endDate = addDays(startDate, 6);

  // comment
  try {
    const bookings = await getApprovedBookingsForRoomWeek({
      roomId,
      startDate,
      endDate,
    });
    return res.json({ startDate, endDate, bookings });
    console.log("bookings", bookings);
  } catch {
    return res.status(500).json({ error: "Failed to fetch calendar bookings" });
  }
});

function addDays(yyyyMmDd, days) {
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

