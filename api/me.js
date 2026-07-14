const { notAllowed, sendJson } = require("./_lib/http");
const { getSessionUserFromRequest } = require("./_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return notAllowed(res, "GET");
  }

  try {
    const user = await getSessionUserFromRequest(req);

    if (!user) {
      return sendJson(res, 401, { authenticated: false });
    }

    return sendJson(res, 200, {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        isActive: user.is_active,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Error interno", detail: error.message });
  }
};
