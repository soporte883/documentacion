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

const DEFAULT_CREDENTIALS = [
  {
    title: "Correo Practicante",
    account: "practicante.aprende@cpdcaldas.org",
    secret: "Tomasob12",
    usage: "Cuenta de trabajo del practicante.",
    status: "ok",
    chip_label: "Cuenta",
    tags: "practicante correo principal cpdcaldas",
  },
  {
    title: "Correo de Soporte",
    account: "soporte@fundacionluker.org.co",
    secret: "SoporTApr2026.",
    usage: "Usado para acceso a Almera y gestion de casos.",
    status: "critical",
    chip_label: "Critico",
    tags: "soporte fundacion luker correo operativo almera",
  },
  {
    title: "Correo Tablets",
    account: "Lukerformare@gmail.com",
    secret: "formareatal48",
    usage: "Gestion de tablets y procesos asociados a dispositivos.",
    status: "ok",
    chip_label: "Activo",
    tags: "tablets correo lukerformare dispositivos",
  },
  {
    title: "Cuenta Monitoreo",
    account: "monitoreo@funluker.org.co",
    secret: "M0n1T0r302025*",
    usage: "Seguimiento de estado y alertas.",
    status: "warn",
    chip_label: "Infra",
    tags: "monitoreo alertas funluker",
  },
  {
    title: "Acceso Sistema Precargas (Admin)",
    account: "admin@local.dev",
    secret: "Admin123456!",
    usage: "Acceso administrador del sistema de precargas. Cambiar clave en el primer ingreso.",
    status: "critical",
    chip_label: "Critico",
    tags: "precargas sistema plataforma admin login acceso vercel",
  },
  {
    title: "Usuario Almera (Precargas)",
    account: "precargas",
    secret: "funluker2026",
    usage: "Acceso a Almera para operar las precargas de estudiantes.",
    status: "ok",
    chip_label: "Precargas",
    tags: "almera precargas usuario conexion sgi estudiantes",
  },
  {
    title: "Usuario n8n",
    account: "practicante.aprende@cpdcaldas.org",
    secret: "practicante123",
    usage: "Acceso a n8n para posibles proyectos de automatizacion.",
    status: "warn",
    chip_label: "Automatizacion",
    tags: "n8n automatizacion workflows proyectos correo",
  },
];

async function main() {
  loadEnvLocal();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no disponible. Verifica .env.local o variables del sistema.");
  }

  const useSsl = process.env.PGSSLMODE !== "disable";
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    const adminEmail = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const adminResult = await pool.query(
      `SELECT id FROM users
       WHERE ($1 <> '' AND LOWER(email) = $1) OR role = 'admin'
       ORDER BY (LOWER(email) = $1) DESC, id ASC
       LIMIT 1`,
      [adminEmail]
    );

    const adminId = adminResult.rows.length ? adminResult.rows[0].id : null;
    let inserted = 0;

    for (const c of DEFAULT_CREDENTIALS) {
      const result = await pool.query(
        `INSERT INTO credentials
           (title, account, secret, usage, status, chip_label, tags, created_by)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8
         WHERE NOT EXISTS (SELECT 1 FROM credentials WHERE title = $1)
         RETURNING id`,
        [c.title, c.account, c.secret, c.usage, c.status, c.chip_label, c.tags, adminId]
      );

      if (result.rows.length) {
        inserted += 1;
        console.log(`+ Insertado: ${c.title}`);
      } else {
        console.log(`= Ya existe (sin cambios): ${c.title}`);
      }
    }

    console.log(`Listo. Credenciales nuevas insertadas: ${inserted}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error sembrando credenciales:", error.message);
  process.exitCode = 1;
});
