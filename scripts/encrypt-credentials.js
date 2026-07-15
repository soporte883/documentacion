const fs = require("fs");
const path = require("path");
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

  const { encryptSecret, isEncrypted, hasEncryptionKey } = require("../api/_lib/crypto");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no disponible. Verifica .env.local.");
  }

  if (!hasEncryptionKey()) {
    throw new Error(
      "CREDENTIALS_ENC_KEY no esta configurada. Agregala a .env.local (y a Vercel) antes de migrar."
    );
  }

  const useSsl = process.env.PGSSLMODE !== "disable";
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    const rows = (await pool.query(`SELECT id, secret FROM credentials`)).rows;
    let migrated = 0;

    for (const row of rows) {
      if (!row.secret || isEncrypted(row.secret)) {
        continue;
      }
      const encrypted = encryptSecret(row.secret);
      await pool.query(`UPDATE credentials SET secret = $1 WHERE id = $2`, [encrypted, row.id]);
      migrated += 1;
      console.log(`+ Cifrada credencial id ${row.id}`);
    }

    console.log(`Listo. Credenciales cifradas: ${migrated}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error cifrando credenciales:", error.message);
  process.exitCode = 1;
});
