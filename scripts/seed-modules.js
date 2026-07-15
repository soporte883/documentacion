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

const DEFAULT_MODULES = [
  {
    title: "Modulo Almera SGI",
    description: "Plataforma principal donde se realiza el seguimiento y gestion operativa.",
    link_url: "https://sgi.almeraim.com/sgi/seguimiento/?nosgim&c=sgifunluker",
    link_text: "Abrir Almera SGI",
    detail_label: "Conexion",
    detail_value: "sgifunluker",
    usage: "Seguimiento y gestion operativa de casos.",
    status: "critical",
    tags: "almera sgi seguimiento",
  },
  {
    title: "Modulo Google Form + App Script",
    description:
      "Formulario creado para recepcion de solicitudes y automatizacion con Apps Script.",
    link_url: "https://docs.google.com/forms/d/1cYfzVeotivUyjNZNIFEqflQlmOhGT1rNoTUGXvY2LMk/edit",
    link_text: "Abrir Google Form",
    detail_label: "Cuenta",
    detail_value: "Usar la cuenta autorizada del formulario (ver seccion Accesos).",
    usage: "Recepcion de solicitudes y automatizacion con Apps Script.",
    status: "ok",
    tags: "google forms appscript formulario lukerforma",
  },
  {
    title: "Modulo ClickUp Soporte",
    description: "Bandeja donde llegan solicitudes enviadas desde el formulario de Google.",
    link_url: "https://app.clickup.com/90171139829/v/b/6-901712948322-2",
    link_text: "Abrir tablero ClickUp",
    detail_label: "Uso",
    detail_value: "Atender tickets, actualizar estado y registrar solucion.",
    usage: "Atender tickets, actualizar estado y registrar solucion.",
    status: "warn",
    tags: "clickup tickets solicitudes soporte",
  },
  {
    title: "Sistema Precargas Almera",
    description:
      "Plataforma para operar precargas de estudiantes en Almera de forma segura: gestion de usuarios y permisos, conexiones cifradas, encuestas, procesos de precarga (descarga, combinar y subir) y monitoreo del worker.",
    link_url: "https://web-kohl-seven-5pnmatyjgk.vercel.app",
    link_text: "Abrir plataforma",
    detail_label: "Ingreso",
    detail_value: "Pantalla /login. Ver manual en la pestana Precargas Almera.",
    usage: "Registrar encuestas, crear procesos de precarga y descargar archivos combinados.",
    status: "ok",
    tags: "precargas almera worker vercel estudiantes encuestas procesos combinar subir proyecto",
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
    // Busca un usuario administrador para asignar como creador.
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

    if (!adminResult.rows.length) {
      throw new Error("No hay ningun usuario admin. Ejecuta primero 'npm run seed:admin'.");
    }

    const adminId = adminResult.rows[0].id;
    let inserted = 0;

    for (const m of DEFAULT_MODULES) {
      const result = await pool.query(
        `INSERT INTO modules
           (title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_by)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
         WHERE NOT EXISTS (SELECT 1 FROM modules WHERE title = $1)
         RETURNING id`,
        [
          m.title,
          m.description,
          m.link_url,
          m.link_text,
          m.detail_label,
          m.detail_value,
          m.usage,
          m.status,
          m.tags,
          adminId,
        ]
      );

      if (result.rows.length) {
        inserted += 1;
        console.log(`+ Insertado: ${m.title}`);
      } else {
        console.log(`= Ya existe (sin cambios): ${m.title}`);
      }
    }

    console.log(`Listo. Modulos nuevos insertados: ${inserted}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error sembrando modulos:", error.message);
  process.exitCode = 1;
});
