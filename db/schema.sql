CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  csrf_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS csrf_token TEXT;

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT modules_status_check CHECK (status IN ('ok', 'warn', 'critical'))
);

ALTER TABLE modules
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS module_notes (
  id BIGSERIAL PRIMARY KEY,
  module_id BIGINT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credentials (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  secret TEXT NOT NULL DEFAULT '',
  usage TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ok',
  chip_label TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credentials_status_check CHECK (status IN ('ok', 'warn', 'critical'))
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_modules_created_at ON modules(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(email, ip, attempted_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_module_notes_module ON module_notes(module_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credentials_created_at ON credentials(created_at DESC);

-- El usuario administrador NO se crea aqui con una clave en texto plano.
-- Usa el script seguro:  npm run seed:admin
-- que toma ADMIN_EMAIL y ADMIN_PASSWORD desde variables de entorno (.env.local).
