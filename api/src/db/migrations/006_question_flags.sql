ALTER TABLE questions ADD COLUMN IF NOT EXISTS flagged     BOOLEAN     DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS flagged_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_questions_flagged ON questions(flagged) WHERE flagged = TRUE;
