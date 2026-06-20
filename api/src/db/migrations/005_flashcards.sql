CREATE TABLE IF NOT EXISTS flashcards (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  UUID        NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  term        TEXT        NOT NULL,
  definition  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_content_id ON flashcards(content_id);
