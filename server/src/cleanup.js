import { pool } from "./db.js";

export async function deleteOldBookings() {
  const { rowCount } = await pool.query(
    "delete from bookings where created_at < now() - interval '3 months'"
  );
  return rowCount;
}

