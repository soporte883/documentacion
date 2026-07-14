const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { createSession, getCookieHeader } = require("./_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return notAllowed(res, "POST");
  }

  try {
    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return sendJson(res, 400, { error: "Correo y clave son obligatorios" });
    }

    const result = await query(
      `SELECT id, email, display_name, password_hash
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    if (!result.rows.length) {
      return sendJson(res, 401, { error: "Credenciales invalidas" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return sendJson(res, 401, { error: "Credenciales invalidas" });
    }

    const session = await createSession(user.id);
    res.setHeader("Set-Cookie", getCookieHeader(session.token, session.expiresAt));

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
