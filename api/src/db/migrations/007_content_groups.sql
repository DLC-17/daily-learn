CREATE TABLE IF NOT EXISTS content_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE content ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES content_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_group_id ON content(group_id);
