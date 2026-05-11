import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { roomsRouter } from "./routes/rooms.js";
import { bookingsRouter } from "./routes/bookings.js";
import { calendarRouter } from "./routes/calendar.js";
import { deleteOldBookings } from "./cleanup.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: false,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);

app.use("/api/rooms", requireAuth, roomsRouter);

app.use("/api/bookings", requireAuth, bookingsRouter);

app.use("/api/calendar", requireAuth, calendarRouter);

// Fallback 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});

// Auto-cleanup: delete bookings older than 3 months.
async function runCleanup() {
  try {
    const deleted = await deleteOldBookings();
    if (deleted) {
      // eslint-disable-next-line no-console
      console.log(`CLEANUP: deleted ${deleted} old bookings`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("CLEANUP_FAILED", e?.message || e);
  }
}

// Run at startup, then every 24 hours.
runCleanup();
setInterval(runCleanup, 24 * 60 * 60 * 1000);

