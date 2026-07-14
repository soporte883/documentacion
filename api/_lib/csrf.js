const crypto = require("crypto");

const CSRF_COOKIE = "doc_csrf";
const CSRF_HEADER = "x-csrf-token";
const CSRF_DAYS = 7;

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
      acc[key] = decodeURIComponent(part.slice(index + 1));
      return acc;
    }, {});
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getCsrfCookieHeader(token, expiresAt) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Not HttpOnly on purpose: the frontend reads it to echo it in a header (double-submit pattern).
  return `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

function getClearCsrfCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

// Double-submit cookie validation: the value in the header must match the cookie.
function isValidCsrf(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken) {
    return false;
  }

  const a = Buffer.from(String(cookieToken));
  const b = Buffer.from(String(headerToken));

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  CSRF_COOKIE,
  CSRF_HEADER,
  CSRF_DAYS,
  createCsrfToken,
  getCsrfCookieHeader,
  getClearCsrfCookieHeader,
  isValidCsrf,
};
