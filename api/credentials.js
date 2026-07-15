const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { getSessionUserFromRequest, requireAdminUser } = require("./_lib/session");
const { isValidCsrf } = require("./_lib/csrf");
const { writeAudit } = require("./_lib/audit");
const { normalizeText } = require("./_lib/validation");

function mapCredential(row) {
  return {
    id: row.id,
    title: row.title,
    account: row.account,
    secret: row.secret,
    usage: row.usage,
    status: row.status,
    chipLabel: row.chip_label,
    tags: row.tags,
    createdAt: row.created_at,
  };
}

function parseFields(body) {
  return {
    title: normalizeText(body.title),
    account: normalizeText(body.account),
    secret: String(body.secret || "").trim(),
    usage: normalizeText(body.usage),
    status: normalizeText(body.status || "ok").toLowerCase(),
    chipLabel: normalizeText(body.chipLabel),
    tags: normalizeText(body.tags),
  };
}

function validateFields(fields) {
  if (!fields.title) {
    return "El titulo es obligatorio";
  }

  if (!fields.account && !fields.secret) {
    return "Debes indicar al menos una cuenta o una clave";
  }

  if (!["ok", "warn", "critical"].includes(fields.status)) {
    return "Estado invalido";
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) {
    return notAllowed(res, "GET, POST, PATCH, DELETE");
  }

  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return sendJson(res, 401, { error: "Sesion invalida" });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const search = normalizeText(url.searchParams.get("search")).toLowerCase();

      const where = search
        ? "WHERE LOWER(title) LIKE $1 OR LOWER(account) LIKE $1 OR LOWER(tags) LIKE $1"
        : "";
      const params = search ? [`%${search}%`] : [];

      const result = await query(
        `SELECT id, title, account, secret, usage, status, chip_label, tags, created_at
         FROM credentials
         ${where}
         ORDER BY created_at ASC
         LIMIT 200`,
        params
      );

      return sendJson(res, 200, { credentials: result.rows.map(mapCredential) });
    }

    // Mutaciones: solo admin y con CSRF valido.
    const adminUser = await requireAdminUser(req);
    if (!adminUser) {
      return sendJson(res, 403, { error: "Solo un administrador puede gestionar accesos" });
    }

    if (!isValidCsrf(req)) {
      return sendJson(res, 403, { error: "Token CSRF invalido o ausente" });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    if (req.method === "POST") {
      const fields = parseFields(body);
      const errorMessage = validateFields(fields);
      if (errorMessage) {
        return sendJson(res, 400, { error: errorMessage });
      }

      const result = await query(
        `INSERT INTO credentials (title, account, secret, usage, status, chip_label, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, title, account, secret, usage, status, chip_label, tags, created_at`,
        [
          fields.title,
          fields.account,
          fields.secret,
          fields.usage,
          fields.status,
          fields.chipLabel,
          fields.tags,
          adminUser.id,
        ]
      );

      const created = result.rows[0];
      writeAudit(adminUser, "credential.create", `credential:${created.id}`, `title:${created.title}`);
      return sendJson(res, 201, { ok: true, credential: mapCredential(created) });
    }

    const credentialId = Number(body.id);
    if (!Number.isInteger(credentialId) || credentialId <= 0) {
      return sendJson(res, 400, { error: "id de credencial invalido" });
    }

    if (req.method === "PATCH") {
      const fields = parseFields(body);
      const errorMessage = validateFields(fields);
      if (errorMessage) {
        return sendJson(res, 400, { error: errorMessage });
      }

      const result = await query(
        `UPDATE credentials SET
           title = $1, account = $2, secret = $3, usage = $4,
           status = $5, chip_label = $6, tags = $7, updated_at = NOW()
         WHERE id = $8
         RETURNING id, title, account, secret, usage, status, chip_label, tags, created_at`,
        [
          fields.title,
          fields.account,
          fields.secret,
          fields.usage,
          fields.status,
          fields.chipLabel,
          fields.tags,
          credentialId,
        ]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { error: "Credencial no encontrada" });
      }

      writeAudit(adminUser, "credential.update", `credential:${credentialId}`, `title:${fields.title}`);
      return sendJson(res, 200, { ok: true, credential: mapCredential(result.rows[0]) });
    }

    // DELETE
    const result = await query(`DELETE FROM credentials WHERE id = $1 RETURNING id`, [credentialId]);
    if (!result.rows.length) {
      return sendJson(res, 404, { error: "Credencial no encontrada" });
    }

    writeAudit(adminUser, "credential.delete", `credential:${credentialId}`, "");
    return sendJson(res, 200, { ok: true, deletedId: credentialId });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
