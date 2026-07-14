CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link_url TEXT NOT NULL,
  link_text TEXT NOT NULL,
  detail_label TEXT NOT NULL,
  detail_value TEXT NOT NULL,
  usage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  tags TEXT NOT NULL DEFAULT '',
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT modules_status_check CHECK (status IN ('ok', 'warn', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_modules_created_at ON modules(created_at DESC);

-- Clave actual configurada para login: soporte123
INSERT INTO users (email, display_name, password_hash)
VALUES (
  'soporte@fundacionluker.org.co',
  'Soporte Fundacion Luker',
  '$2b$12$eh0p9tZDUhc7zTfXWVNTMO/f/D07xWp0kYmsVSLNDAt6/TwgKEqJC'
)
ON CONFLICT (email) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = 'admin',
  is_active = TRUE,
  password_hash = EXCLUDED.password_hash;
