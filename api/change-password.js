const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { getSessionUserFromRequest } = require("./_lib/session");
const { isValidCsrf } = require("./_lib/csrf");
const { writeAudit } = require("./_lib/audit");
const { isStrongEnoughPassword, MIN_PASSWORD_LENGTH } = require("./_lib/validation");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return notAllowed(res, "POST");
  }

  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return sendJson(res, 401, { error: "Sesion invalida" });
    }

    if (!isValidCsrf(req)) {
      return sendJson(res, 403, { error: "Token CSRF invalido o ausente" });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return sendJson(res, 400, { error: "Clave actual y nueva son obligatorias" });
    }

    if (!isStrongEnoughPassword(newPassword)) {
      return sendJson(res, 400, {
        error: `La nueva clave debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }

    if (currentPassword === newPassword) {
      return sendJson(res, 400, { error: "La nueva clave debe ser diferente a la actual" });
    }

    const result = await query(`SELECT password_hash FROM users WHERE id = $1 LIMIT 1`, [
      sessionUser.id,
    ]);

    if (!result.rows.length) {
      return sendJson(res, 404, { error: "Usuario no encontrado" });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return sendJson(res, 401, { error: "La clave actual es incorrecta" });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query(`UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2`, [
      newHash,
      sessionUser.id,
    ]);

    // Cierra otras sesiones por seguridad, pero mantiene la actual.
    const cookies = req.headers.cookie || "";
    const currentTokenMatch = cookies.match(/doc_session=([^;]+)/);
    const currentToken = currentTokenMatch ? decodeURIComponent(currentTokenMatch[1]) : null;

    if (currentToken) {
      await query(`DELETE FROM sessions WHERE user_id = $1 AND token <> $2`, [
        sessionUser.id,
        currentToken,
      ]);
    }

    writeAudit(sessionUser, "user.changePassword", `user:${sessionUser.id}`, "");
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
