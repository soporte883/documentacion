const { Pool } = require("pg");

let pool;
let bootstrapPromise;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no esta configurada");
  }

  if (!pool) {
    const useSsl = process.env.PGSSLMODE !== "disable";
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }

  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();
  await ensureSchema(activePool);
  return activePool.query(text, params);
}

async function ensureSchema(activePool) {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    await activePool.query(
      `CREATE TABLE IF NOT EXISTS users (
         id BIGSERIAL PRIMARY KEY,
         email TEXT NOT NULL UNIQUE,
         display_name TEXT NOT NULL,
         password_hash TEXT NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    );

    await activePool.query(
      `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`
    );

    await activePool.query(
      `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`
    );

    await activePool.query(
      `CREATE TABLE IF NOT EXISTS sessions (
         id BIGSERIAL PRIMARY KEY,
         token TEXT NOT NULL UNIQUE,
         user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         expires_at TIMESTAMPTZ NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    );

    await activePool.query(
      `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`
    );

    await activePool.query(
      `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`
    );

    await activePool.query(
      `CREATE TABLE IF NOT EXISTS modules (
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
       )`
    );

    await activePool.query(
      `CREATE INDEX IF NOT EXISTS idx_modules_created_at ON modules(created_at DESC)`
    );
  })();

  return bootstrapPromise;
}

module.exports = {
  query,
};
