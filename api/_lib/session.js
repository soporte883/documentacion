const crypto = require("crypto");
const { query } = require("./db");

const SESSION_COOKIE = "doc_session";
const SESSION_DAYS = 7;

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        return acc;
      }
      const key = decodeURIComponent(part.slice(0, index));
      const value = decodeURIComponent(part.slice(index + 1));
      acc[key] = value;
      return acc;
    }, {});
}

function createSessionToken() {
  return crypto.randomBytes(48).toString("hex");
}

function getCookieHeader(token, expiresAt) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

function getClearCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

async function createSession(userId) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );

  return {
    token,
    expiresAt,
  };
}

async function getSessionUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const result = await query(
    `SELECT u.id, u.email, u.display_name
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0];
}

async function deleteSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return;
  }

  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

module.exports = {
  SESSION_COOKIE,
  createSession,
  deleteSessionFromRequest,
  getClearCookieHeader,
  getCookieHeader,
  getSessionUserFromRequest,
};
