const { query } = require("./_lib/db");
const { notAllowed, sendJson } = require("./_lib/http");
const { requireAdminUser } = require("./_lib/session");
const { normalizeText } = require("./_lib/validation");

function mapLog(row) {
  return {
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    target: row.target,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return notAllowed(res, "GET");
  }

  try {
    const adminUser = await requireAdminUser(req);
    if (!adminUser) {
      return sendJson(res, 403, { error: "Solo un administrador puede ver la auditoria" });
    }

    const url = new URL(req.url, "http://localhost");
    const search = normalizeText(url.searchParams.get("search")).toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

    const where = search
      ? "WHERE LOWER(actor_email) LIKE $1 OR LOWER(action) LIKE $1 OR LOWER(target) LIKE $1 OR LOWER(detail) LIKE $1"
      : "";
    const params = search ? [`%${search}%`] : [];

    const result = await query(
      `SELECT id, actor_email, action, target, detail, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      params
    );

    return sendJson(res, 200, { logs: result.rows.map(mapLog) });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
