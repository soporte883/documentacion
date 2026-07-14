const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { getSessionUserFromRequest, requireAdminUser } = require("./_lib/session");

function normalizeText(value) {
  return String(value || "").trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return notAllowed(res, "GET, POST");
  }

  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return sendJson(res, 401, { error: "Sesion invalida" });
    }

    if (req.method === "GET") {
      const result = await query(
        `SELECT id, title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_at
         FROM modules
         ORDER BY created_at DESC`
      );

      return sendJson(res, 200, {
        modules: result.rows.map((row) => ({
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
        })),
      });
    }

    const adminUser = await requireAdminUser(req);
    if (!adminUser) {
      return sendJson(res, 403, { error: "Solo un administrador puede crear modulos" });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    const title = normalizeText(body.title);
    const description = normalizeText(body.description);
    const linkUrl = normalizeText(body.linkUrl);
    const linkText = normalizeText(body.linkText);
    const detailLabel = normalizeText(body.detailLabel);
    const detailValue = normalizeText(body.detailValue);
    const usage = normalizeText(body.usage);
    const status = normalizeText(body.status || "ok").toLowerCase();
    const tags = normalizeText(body.tags);

    if (!title || !description || !linkUrl || !linkText || !detailLabel || !detailValue || !usage) {
      return sendJson(res, 400, { error: "Todos los campos principales son obligatorios" });
    }

    if (!["ok", "warn", "critical"].includes(status)) {
      return sendJson(res, 400, { error: "Estado invalido" });
    }

    const result = await query(
      `INSERT INTO modules
       (title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title, description, link_url, link_text, detail_label, detail_value, usage, status, tags, created_at`,
      [title, description, linkUrl, linkText, detailLabel, detailValue, usage, status, tags, adminUser.id]
    );

    const created = result.rows[0];
    return sendJson(res, 201, {
      ok: true,
      module: {
        id: created.id,
        title: created.title,
        description: created.description,
        linkUrl: created.link_url,
        linkText: created.link_text,
        detailLabel: created.detail_label,
        detailValue: created.detail_value,
        usage: created.usage,
        status: created.status,
        tags: created.tags,
        createdAt: created.created_at,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
