const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { getSessionUserFromRequest } = require("./_lib/session");
const { isValidCsrf } = require("./_lib/csrf");
const { writeAudit } = require("./_lib/audit");
const { normalizeText } = require("./_lib/validation");

const MAX_NOTE_LENGTH = 2000;

function mapNote(row) {
  return {
    id: row.id,
    moduleId: row.module_id,
    userId: row.user_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  };
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    return notAllowed(res, "GET, POST, DELETE");
  }

  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return sendJson(res, 401, { error: "Sesion invalida" });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const moduleId = Number(url.searchParams.get("moduleId"));
      if (!Number.isInteger(moduleId) || moduleId <= 0) {
        return sendJson(res, 400, { error: "moduleId invalido" });
      }

      const result = await query(
        `SELECT id, module_id, user_id, author_name, content, created_at
         FROM module_notes
         WHERE module_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [moduleId]
      );

      return sendJson(res, 200, { notes: result.rows.map(mapNote) });
    }

    // Mutaciones requieren CSRF valido.
    if (!isValidCsrf(req)) {
      return sendJson(res, 403, { error: "Token CSRF invalido o ausente" });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    if (req.method === "POST") {
      const moduleId = Number(body.moduleId);
      const content = normalizeText(body.content);

      if (!Number.isInteger(moduleId) || moduleId <= 0) {
        return sendJson(res, 400, { error: "moduleId invalido" });
      }

      if (!content) {
        return sendJson(res, 400, { error: "La nota no puede estar vacia" });
      }

      if (content.length > MAX_NOTE_LENGTH) {
        return sendJson(res, 400, {
          error: `La nota no puede superar ${MAX_NOTE_LENGTH} caracteres`,
        });
      }

      const moduleExists = await query(`SELECT id FROM modules WHERE id = $1`, [moduleId]);
      if (!moduleExists.rows.length) {
        return sendJson(res, 404, { error: "Modulo no encontrado" });
      }

      const authorName = sessionUser.display_name || sessionUser.email;
      const result = await query(
        `INSERT INTO module_notes (module_id, user_id, author_name, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, module_id, user_id, author_name, content, created_at`,
        [moduleId, sessionUser.id, authorName, content]
      );

      writeAudit(sessionUser, "note.create", `module:${moduleId}`, `note:${result.rows[0].id}`);
      return sendJson(res, 201, { ok: true, note: mapNote(result.rows[0]) });
    }

    // DELETE: el autor o un admin pueden borrar la nota.
    const noteId = Number(body.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      return sendJson(res, 400, { error: "id de nota invalido" });
    }

    const existing = await query(`SELECT id, user_id FROM module_notes WHERE id = $1`, [noteId]);
    if (!existing.rows.length) {
      return sendJson(res, 404, { error: "Nota no encontrada" });
    }

    const isAdmin =
      sessionUser.role === "admin" ||
      String(sessionUser.email || "").toLowerCase() === "soporte@fundacionluker.org.co";
    const isAuthor = Number(existing.rows[0].user_id) === Number(sessionUser.id);

    if (!isAdmin && !isAuthor) {
      return sendJson(res, 403, { error: "Solo el autor o un admin pueden eliminar la nota" });
    }

    await query(`DELETE FROM module_notes WHERE id = $1`, [noteId]);
    writeAudit(sessionUser, "note.delete", `note:${noteId}`, "");
    return sendJson(res, 200, { ok: true, deletedId: noteId });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
