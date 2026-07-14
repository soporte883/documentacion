const { notAllowed, sendJson } = require("./_lib/http");
const { deleteSessionFromRequest, getClearCookieHeader } = require("./_lib/session");
const { getClearCsrfCookieHeader } = require("./_lib/csrf");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return notAllowed(res, "POST");
  }

  try {
    await deleteSessionFromRequest(req);
    res.setHeader("Set-Cookie", [getClearCookieHeader(), getClearCsrfCookieHeader()]);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
