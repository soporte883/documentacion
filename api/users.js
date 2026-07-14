const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { notAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { requireAdminUser } = require("./_lib/session");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value || "").trim();
}

function normalizeRole(value) {
  return String(value || "user").trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH") {
    return notAllowed(res, "GET, POST, PATCH");
  }

  try {
    const adminUser = await requireAdminUser(req);
    if (!adminUser) {
      return sendJson(res, 403, { error: "Solo un administrador puede gestionar usuarios" });
    }

    if (req.method === "GET") {
      const result = await query(
        `SELECT id, email, display_name, role, is_active, created_at
         FROM users
         ORDER BY created_at DESC`
      );

      return sendJson(res, 200, {
        users: result.rows.map((row) => ({
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          role: row.role,
          isActive: row.is_active,
          createdAt: row.created_at,
        })),
      });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "JSON invalido" });
    }

    if (req.method === "POST") {
      const email = normalizeEmail(body.email);
      const displayName = normalizeDisplayName(body.displayName);
      const password = String(body.password || "");
      const role = normalizeRole(body.role);

      if (!email || !displayName || !password) {
        return sendJson(res, 400, { error: "Correo, nombre y clave son obligatorios" });
      }

      if (password.length < 8) {
        return sendJson(res, 400, { error: "La clave debe tener al menos 8 caracteres" });
      }

      if (role !== "admin" && role !== "user") {
        return sendJson(res, 400, { error: "Rol invalido" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await query(
        `INSERT INTO users (email, display_name, role, is_active, password_hash)
         VALUES ($1, $2, $3, TRUE, $4)
         RETURNING id, email, display_name, role, is_active, created_at`,
        [email, displayName, role, passwordHash]
      );

      const created = result.rows[0];
      return sendJson(res, 201, {
        ok: true,
        user: {
          id: created.id,
          email: created.email,
          displayName: created.display_name,
          role: created.role,
          isActive: created.is_active,
          createdAt: created.created_at,
        },
      });
    }

    const userId = Number(body.userId);
    const isActive = Boolean(body.isActive);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendJson(res, 400, { error: "userId invalido" });
    }

    if (userId === Number(adminUser.id) && !isActive) {
      return sendJson(res, 400, { error: "No puedes inactivar tu propio usuario" });
    }

    const result = await query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2
       RETURNING id, email, display_name, role, is_active, created_at`,
      [isActive, userId]
    );

    if (!result.rows.length) {
      return sendJson(res, 404, { error: "Usuario no encontrado" });
    }

    const updated = result.rows[0];
    return sendJson(res, 200, {
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.display_name,
        role: updated.role,
        isActive: updated.is_active,
        createdAt: updated.created_at,
      },
    });
  } catch (error) {
    if (error && error.code === "23505") {
      return sendJson(res, 409, { error: "Ese correo ya esta registrado" });
    }

    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
