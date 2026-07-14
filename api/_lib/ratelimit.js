const { query } = require("./db");

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}

// Cuenta intentos fallidos recientes para email+ip. Devuelve true si esta bloqueado.
async function isRateLimited(email, ip) {
  const result = await query(
    `SELECT COUNT(*)::int AS failed
     FROM login_attempts
     WHERE email = $1
       AND ip = $2
       AND success = FALSE
       AND attempted_at > NOW() - ($3 || ' minutes')::interval`,
    [email, ip, String(WINDOW_MINUTES)]
  );

  return (result.rows[0]?.failed ?? 0) >= MAX_FAILED_ATTEMPTS;
}

async function recordAttempt(email, ip, success) {
  await query(
    `INSERT INTO login_attempts (email, ip, success)
     VALUES ($1, $2, $3)`,
    [email, ip, Boolean(success)]
  );
}

// Limpieza oportunista de registros antiguos (mas de 1 dia).
async function cleanupOldAttempts() {
  try {
    await query(`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'`);
  } catch (error) {
    console.error("No se pudo limpiar login_attempts:", error.message);
  }
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  WINDOW_MINUTES,
  getClientIp,
  isRateLimited,
  recordAttempt,
  cleanupOldAttempts,
};
