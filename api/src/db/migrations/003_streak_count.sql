ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'streak' AND table_schema = current_schema()
  ) THEN
    UPDATE users SET streak_count = streak WHERE streak > 0;
    ALTER TABLE users DROP COLUMN streak;
  END IF;
END $$;
