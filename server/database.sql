-- RoomBooking schema + seed
-- Works on Supabase Postgres (or any PostgreSQL 13+)

BEGIN;

-- First admin: isaac.benit@testsolutions.de
-- Uses Postgres' built-in bcrypt via pgcrypto (crypt + gen_salt('bf')).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Employee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS rooms (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  meeting_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_booking_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_date_status ON bookings(room_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_created ON bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at DESC);

CREATE TABLE IF NOT EXISTS registration_requests (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_requests_status_created
  ON registration_requests(status, created_at DESC);

-- Seed permanent first admin (idempotent)
INSERT INTO users (full_name, email, password_hash, role)
VALUES (
  'Isaac Benit',
  'isaac.benit@testsolutions.de',
  crypt('moviebenit@1', gen_salt('bf', 12)),
  'Admin'
)
ON CONFLICT (email) DO NOTHING;

-- Seed exactly 2 rooms (idempotent)
INSERT INTO rooms (name, description)
VALUES
  ('Business Class Room', 'Executive boardroom, seats 12, full AV setup'),
  ('Ground Floor Operations Room', 'Operations hub, open layout, seats 20')
ON CONFLICT (name) DO NOTHING;

COMMIT;

