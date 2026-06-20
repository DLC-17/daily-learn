CREATE TABLE IF NOT EXISTS topics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE content ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_text TEXT;

CREATE INDEX IF NOT EXISTS idx_content_topic_id ON content(topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
