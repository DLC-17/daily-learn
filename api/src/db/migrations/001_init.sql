CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        UNIQUE NOT NULL,
  password_hash   TEXT        NOT NULL,
  refresh_token   TEXT,
  push_token      TEXT,
  streak          INT         DEFAULT 0,
  last_active     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  raw_text        TEXT        NOT NULL,
  file_name       TEXT,
  chunk_count     INT         DEFAULT 0,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      UUID        NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  question_text   TEXT        NOT NULL,
  options         JSONB       NOT NULL,
  correct_index   INT         NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  times_shown     INT         DEFAULT 0,
  times_correct   INT         DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_index    INT         NOT NULL,
  is_correct      BOOL        NOT NULL,
  shown_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id     UUID        REFERENCES questions(id) ON DELETE SET NULL,
  slot            INT         NOT NULL CHECK (slot BETWEEN 0 AND 2),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  date            DATE        NOT NULL,
  UNIQUE (user_id, date, slot)
);

CREATE INDEX IF NOT EXISTS idx_questions_content_id ON questions(content_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_due
  ON scheduled_notifications(scheduled_at)
  WHERE sent_at IS NULL;
