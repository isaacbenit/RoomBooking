import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { requireAdmin, requireAuth } from "./auth.js";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { roomsRouter } from "./routes/rooms.js";
import { bookingsRouter } from "./routes/bookings.js";
import { calendarRouter } from "./routes/calendar.js";
import { deleteOldBookings } from "./cleanup.js";
import { adminRouter } from "./routes/admin.js";
import { usersRouter } from "./routes/users.js";

const app = express();

// Security headers
app.use(helmet());

// CORS: allow all localhost in development, restrict to Netlify in production
const allowedOrigins = [
  "https://bookingsolution.netlify.app",
];
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Render health checks)
      if (!origin) return cb(null, true);
      // In production, only allow the deployed frontend
      if (process.env.NODE_ENV === "production") {
        return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"));
      }
      // In development, allow any localhost origin regardless of port
      if (origin.startsWith("http://localhost:")) return cb(null, true);
      return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },
    credentials: false,
  })
);

app.use(express.json({ limit: "1mb" }));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

const requestAccessLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many access requests. Please try again in an hour." },
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  message: { error: "Too many password change attempts. Please try again in 15 minutes." },
  validate: { defaultKeys: false }, // Add this line!
});


app.set('trust proxy', 1);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Rate limiters must be registered before the router handles the routes
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/request-access", requestAccessLimiter);

app.use("/api/auth", authRouter);

app.use("/api/rooms", requireAuth, roomsRouter);

// Public room list for the landing page (no auth required)
app.get("/api/public/rooms", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "select name, description from rooms order by id asc"
    );
    return res.json({ rooms: rows });
  } catch {
    return res.status(500).json({ error: "Failed to fetch rooms" });
  }
});
app.use("/api/users", requireAuth, usersRouter);
app.use("/api/bookings", requireAuth, bookingsRouter);
app.use("/api/calendar", requireAuth, calendarRouter);
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

// Fallback 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
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

runCleanup();
setInterval(runCleanup, 24 * 60 * 60 * 1000);
