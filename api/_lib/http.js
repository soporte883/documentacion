function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function notAllowed(res, method = "POST") {
  res.setHeader("Allow", method);
  sendJson(res, 405, { error: `Metodo no permitido. Usa ${method}` });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = {
  sendJson,
  notAllowed,
  readJsonBody,
};
