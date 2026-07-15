const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { requireAdminUser } = require("./_lib/session");
const { isValidCsrf } = require("./_lib/csrf");
const { writeAudit } = require("./_lib/audit");
const {
  normalizeText,
  normalizeEmail,
  isValidEmail,
  isStrongEnoughPassword,
  isValidRole,
  MIN_PASSWORD_LENGTH,
} = require("./_lib/validation");

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

module.exports = async function handler(req, res) {
  if (
    req.method !== "GET" &&
    req.method !== "POST" &&
    req.method !== "PATCH" &&
    req.method !== "DELETE"
  ) {
    return notAllowed(res, "GET, POST, PATCH, DELETE");
  }

  try {
    const adminUser = await requireAdminUser(req);
    if (!adminUser) {
      return sendJson(res, 403, { error: "Solo un administrador puede gestionar usuarios" });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const search = normalizeText(url.searchParams.get("search")).toLowerCase();
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
      const offset = (page - 1) * pageSize;

      const where = search ? "WHERE LOWER(email) LIKE $1 OR LOWER(display_name) LIKE $1" : "";
      const params = search ? [`%${search}%`] : [];

      const totalResult = await query(`SELECT COUNT(*)::int AS total FROM users ${where}`, params);
      const total = totalResult.rows[0]?.total ?? 0;

      const result = await query(
        `SELECT id, email, display_name, role, is_active, created_at
         FROM users
         ${where}
         ORDER BY created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
      );

      return sendJson(res, 200, {
        users: result.rows.map(mapUser),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    if (!isValidCsrf(req)) {
      return sendJson(res, 403, { error: "Token CSRF invalido o ausente" });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    if (req.method === "POST") {
      const email = normalizeEmail(body.email);
      const displayName = normalizeText(body.displayName);
      const password = String(body.password || "");
      const role = normalizeText(body.role || "user").toLowerCase();

      if (!email || !displayName || !password) {
        return sendJson(res, 400, { error: "Correo, nombre y clave son obligatorios" });
      }

      if (!isValidEmail(email)) {
        return sendJson(res, 400, { error: "Correo invalido" });
      }

      if (!isStrongEnoughPassword(password)) {
        return sendJson(res, 400, {
          error: `La clave debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
        });
      }

      if (!isValidRole(role)) {
        return sendJson(res, 400, { error: "Rol invalido" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await query(
        `INSERT INTO users (email, display_name, role, is_active, must_change_password, password_hash)
         VALUES ($1, $2, $3, TRUE, TRUE, $4)
         RETURNING id, email, display_name, role, is_active, created_at`,
        [email, displayName, role, passwordHash]
      );

      const created = result.rows[0];
      writeAudit(
        adminUser,
        "user.create",
        `user:${created.id}`,
        `email:${created.email} role:${created.role}`
      );
      return sendJson(res, 201, { ok: true, user: mapUser(created) });
    }

    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendJson(res, 400, { error: "userId invalido" });
    }

    if (req.method === "DELETE") {
      if (userId === Number(adminUser.id)) {
        return sendJson(res, 400, { error: "No puedes eliminar tu propio usuario" });
      }

      try {
        const result = await query(
          `DELETE FROM users WHERE id = $1 RETURNING id, email`,
          [userId]
        );

        if (!result.rows.length) {
          return sendJson(res, 404, { error: "Usuario no encontrado" });
        }

        writeAudit(adminUser, "user.delete", `user:${userId}`, `email:${result.rows[0].email}`);
        return sendJson(res, 200, { ok: true, deletedId: userId });
      } catch (deleteError) {
        if (deleteError && deleteError.code === "23503") {
          return sendJson(res, 409, {
            error:
              "No se puede eliminar: el usuario tiene modulos u otros registros asociados. Reasignalos o usa 'Inactivar'.",
          });
        }
        throw deleteError;
      }
    }

    const action =
      normalizeText(body.action) || (typeof body.isActive === "boolean" ? "toggleActive" : "");

    if (action === "toggleActive") {
      const isActive = Boolean(body.isActive);

      if (userId === Number(adminUser.id) && !isActive) {
        return sendJson(res, 400, { error: "No puedes inactivar tu propio usuario" });
      }

      const result = await query(
        `UPDATE users SET is_active = $1 WHERE id = $2
         RETURNING id, email, display_name, role, is_active, created_at`,
        [isActive, userId]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { error: "Usuario no encontrado" });
      }

      writeAudit(adminUser, "user.toggleActive", `user:${userId}`, `isActive:${isActive}`);
      return sendJson(res, 200, { ok: true, user: mapUser(result.rows[0]) });
    }

    if (action === "updateProfile") {
      const displayName = normalizeText(body.displayName);
      const role = normalizeText(body.role || "user").toLowerCase();

      if (!displayName) {
        return sendJson(res, 400, { error: "El nombre es obligatorio" });
      }

      if (!isValidRole(role)) {
        return sendJson(res, 400, { error: "Rol invalido" });
      }

      if (userId === Number(adminUser.id) && role !== "admin") {
        return sendJson(res, 400, {
          error: "No puedes quitarte a ti mismo el rol de administrador",
        });
      }

      const result = await query(
        `UPDATE users SET display_name = $1, role = $2 WHERE id = $3
         RETURNING id, email, display_name, role, is_active, created_at`,
        [displayName, role, userId]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { error: "Usuario no encontrado" });
      }

      writeAudit(
        adminUser,
        "user.updateProfile",
        `user:${userId}`,
        `name:${displayName} role:${role}`
      );
      return sendJson(res, 200, { ok: true, user: mapUser(result.rows[0]) });
    }

    if (action === "resetPassword") {
      const password = String(body.password || "");

      if (!isStrongEnoughPassword(password)) {
        return sendJson(res, 400, {
          error: `La clave debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const result = await query(
        `UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2
         RETURNING id, email, display_name, role, is_active, created_at`,
        [passwordHash, userId]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { error: "Usuario no encontrado" });
      }

      await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
      writeAudit(adminUser, "user.resetPassword", `user:${userId}`, "");
      return sendJson(res, 200, { ok: true, user: mapUser(result.rows[0]) });
    }

    return sendJson(res, 400, { error: "Accion no reconocida" });
  } catch (error) {
    if (error && error.code === "23505") {
      return sendJson(res, 409, { error: "Ese correo ya esta registrado" });
    }

    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
