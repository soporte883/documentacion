const { query } = require("./_lib/db");
const { notAllowed, sendJson } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return notAllowed(res, "GET");
  }

  const health = { status: "ok", time: new Date().toISOString(), db: "unknown" };

  try {
    await query("SELECT 1");
    health.db = "ok";
    return sendJson(res, 200, health);
  } catch (error) {
    health.status = "degraded";
    health.db = "error";
    health.detail = error.message;
    return sendJson(res, 503, health);
  }
};
