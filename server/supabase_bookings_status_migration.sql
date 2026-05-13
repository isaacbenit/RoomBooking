-- Run in Supabase SQL Editor if you get:
-- ERROR: 23514: new row for relation "bookings" violates check constraint "bookings_status_check"
--
-- Step 0 (optional): discover constraint name
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'bookings'::regclass AND contype = 'c';

-- Step 0b (optional): drop any CHECK constraint on bookings whose definition mentions status
-- (use if the constraint name is not exactly bookings_status_check)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    WHERE rel.relname = 'bookings' AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

UPDATE bookings
SET status = 'confirmed'
WHERE status IS DISTINCT FROM 'cancelled';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'cancelled'));

ALTER TABLE bookings
  ALTER COLUMN status SET DEFAULT 'confirmed';
