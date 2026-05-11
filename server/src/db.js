import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

function shouldUseSsl(databaseUrl) {
  const s = String(databaseUrl || "");
  const lower = s.toLowerCase();
  if (process.env.PGSSLMODE?.toLowerCase() === "require") return true;
  if (lower.includes("sslmode=require")) return true;
  // Supabase hosted Postgres typically requires SSL even in local dev.
  if (lower.includes("supabase.co")) return true;
  if (lower.includes("pooler.supabase.com")) return true;
  return process.env.NODE_ENV === "production";
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : undefined,
});

