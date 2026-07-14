const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { getSessionUserFromRequest, requireAdminUser } = require("./_lib/session");
const { isValidCsrf } = require("./_lib/csrf");
const { writeAudit } = require("./_lib/audit");
const { normalizeText, isSafeHttpUrl } = require("./_lib/validation");

function mapModule(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    linkUrl: row.link_url,
    linkText: row.link_text,
    detailLabel: row.detail_label,
    detailValue: row.detail_value,
    usage: row.usage,
    status: row.status,
    tags: row.tags,
    createdAt: row.created_at,
  };
}

function parseModuleFields(body) {
  return {
    title: normalizeText(body.title),
    description: normalizeText(body.description),
    linkUrl: normalizeText(body.linkUrl),
    linkText: normalizeText(body.linkText),
    detailLabel: normalizeText(body.detailLabel),
    detailValue: normalizeText(body.detailValue),
    usage: normalizeText(body.usage),
    status: normalizeText(body.status || "ok").toLowerCase(),
    tags: normalizeText(body.tags),
  };
}

function validateModuleFields(fields) {
  const { title, description, linkUrl, linkText, detailLabel, detailValue, usage, status } = fields;

  if (!title || !description || !linkUrl || !linkText || !detailLabel || !detailValue || !usage) {
    return "Todos los campos principales son obligatorios";
  }

  if (!isSafeHttpUrl(linkUrl)) {
    return "El enlace debe ser una URL http/https valida";
  }

  if (!["ok", "warn", "critical"].includes(status)) {
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
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));
      const offset = (page - 1) * pageSize;

      const where = search
        ? "WHERE LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(tags) LIKE $1"
        : "";
      const params = search ? [`%${search}%`] : [];

      const totalResult = await query(
        `SELECT COUNT(*)::int AS total FROM modules ${where}`,
        params
      );
      const total = totalResult.rows[0]?.total ?? 0;

      const result = await query(
        `SELECT id, title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_at
         FROM modules
         ${where}
         ORDER BY created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
      );

      return sendJson(res, 200, {
        modules: result.rows.map(mapModule),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    // Mutaciones: solo admin y con CSRF valido.
    const adminUser = await requireAdminUser(req);
    if (!adminUser) {
      return sendJson(res, 403, { error: "Solo un administrador puede gestionar modulos" });
    }

    if (!isValidCsrf(req)) {
      return sendJson(res, 403, { error: "Token CSRF invalido o ausente" });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    if (req.method === "POST") {
      const fields = parseModuleFields(body);
      const errorMessage = validateModuleFields(fields);
      if (errorMessage) {
        return sendJson(res, 400, { error: errorMessage });
      }

      const result = await query(
        `INSERT INTO modules
         (title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_at`,
        [
          fields.title,
          fields.description,
          fields.linkUrl,
          fields.linkText,
          fields.detailLabel,
          fields.detailValue,
          fields.usage,
          fields.status,
          fields.tags,
          adminUser.id,
        ]
      );

      const created = result.rows[0];
      writeAudit(adminUser, "module.create", `module:${created.id}`, `title:${created.title}`);
      return sendJson(res, 201, { ok: true, module: mapModule(created) });
    }

    const moduleId = Number(body.id);
    if (!Number.isInteger(moduleId) || moduleId <= 0) {
      return sendJson(res, 400, { error: "id de modulo invalido" });
    }

    if (req.method === "PATCH") {
      const fields = parseModuleFields(body);
      const errorMessage = validateModuleFields(fields);
      if (errorMessage) {
        return sendJson(res, 400, { error: errorMessage });
      }

      const result = await query(
        `UPDATE modules SET
           title = $1, description = $2, link_url = $3, link_text = $4,
           detail_label = $5, detail_value = $6, usage = $7, status = $8, tags = $9,
           updated_at = NOW()
         WHERE id = $10
         RETURNING id, title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_at`,
        [
          fields.title,
          fields.description,
          fields.linkUrl,
          fields.linkText,
          fields.detailLabel,
          fields.detailValue,
          fields.usage,
          fields.status,
          fields.tags,
          moduleId,
        ]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { error: "Modulo no encontrado" });
      }

      writeAudit(adminUser, "module.update", `module:${moduleId}`, `title:${fields.title}`);
      return sendJson(res, 200, { ok: true, module: mapModule(result.rows[0]) });
    }

    // DELETE
    const result = await query(`DELETE FROM modules WHERE id = $1 RETURNING id`, [moduleId]);
    if (!result.rows.length) {
      return sendJson(res, 404, { error: "Modulo no encontrado" });
    }

    writeAudit(adminUser, "module.delete", `module:${moduleId}`, "");
    return sendJson(res, 200, { ok: true, deletedId: moduleId });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
