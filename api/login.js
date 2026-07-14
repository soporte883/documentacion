const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { cleanupExpiredSessions, createSession, getCookieHeader } = require("./_lib/session");
const { getCsrfCookieHeader } = require("./_lib/csrf");
const {
  getClientIp,
  isRateLimited,
  recordAttempt,
  cleanupOldAttempts,
} = require("./_lib/ratelimit");
const { writeAudit } = require("./_lib/audit");
const { normalizeEmail } = require("./_lib/validation");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return notAllowed(res, "POST");
  }

  const ip = getClientIp(req);

  try {
    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !password) {
      return sendJson(res, 400, { error: "Correo y clave son obligatorios" });
    }

    if (await isRateLimited(email, ip)) {
      return sendJson(res, 429, {
        error: "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.",
      });
    }

    const result = await query(
      `SELECT id, email, display_name, role, is_active, must_change_password, password_hash
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    if (!result.rows.length) {
      await recordAttempt(email, ip, false);
      return sendJson(res, 401, { error: "Credenciales invalidas" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await recordAttempt(email, ip, false);
      return sendJson(res, 403, { error: "Tu usuario esta inactivo" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      await recordAttempt(email, ip, false);
      return sendJson(res, 401, { error: "Credenciales invalidas" });
    }

    await recordAttempt(email, ip, true);

    const session = await createSession(user.id);
    res.setHeader("Set-Cookie", [
      getCookieHeader(session.token, session.expiresAt),
      getCsrfCookieHeader(session.csrfToken, session.expiresAt),
    ]);

    // Mantenimiento oportunista (no bloquea la respuesta si falla).
    cleanupExpiredSessions();
    cleanupOldAttempts();
    writeAudit(user, "login", `user:${user.id}`, `ip:${ip}`);

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
