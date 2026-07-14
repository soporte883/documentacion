const { query } = require("./db");

// Registra una accion administrativa/sensible para auditoria.
// Nunca lanza: la auditoria no debe romper la operacion principal.
async function writeAudit(actor, action, target = "", detail = "") {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, actor_email, action, target, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actor?.id ?? null,
        String(actor?.email || ""),
        String(action || "unknown"),
        String(target || ""),
        typeof detail === "string" ? detail : JSON.stringify(detail),
      ]
    );
  } catch (error) {
    // Log en consola pero no interrumpe el flujo.
    console.error("No se pudo escribir audit log:", error.message);
  }
}

module.exports = {
  writeAudit,
};
