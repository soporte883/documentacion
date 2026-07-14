const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no disponible. Verifica .env.local o variables del sistema.");
  }

  const email = String(process.env.ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  const displayName = String(process.env.ADMIN_NAME || "Administrador").trim();

  if (!email || !password) {
    throw new Error(
      "Define ADMIN_EMAIL y ADMIN_PASSWORD (en .env.local o entorno) para sembrar el administrador."
    );
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const useSsl = process.env.PGSSLMODE !== "disable";
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query(
      `INSERT INTO users (email, display_name, role, is_active, password_hash)
       VALUES ($1, $2, 'admin', TRUE, $3)
       ON CONFLICT (email) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           role = 'admin',
           is_active = TRUE,
           password_hash = EXCLUDED.password_hash`,
      [email, displayName, passwordHash]
    );
    console.log(`Administrador '${email}' sembrado/actualizado correctamente.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error sembrando administrador:", error.message);
  process.exitCode = 1;
});
