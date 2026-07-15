const crypto = require("crypto");

// Cifrado simetrico para secretos almacenados (claves de credenciales).
// Usa AES-256-GCM. La clave se toma de CREDENTIALS_ENC_KEY (o ENCRYPTION_KEY).
// Formato en BD: "enc:v1:<ivB64>:<tagB64>:<dataB64>".
// Si no hay clave configurada, guarda/lee en texto plano (fallback seguro para
// no romper la app), pero se recomienda configurar la clave en produccion.

const PREFIX = "enc:v1:";

function getKey() {
  const raw = process.env.CREDENTIALS_ENC_KEY || process.env.ENCRYPTION_KEY || "";
  if (!raw) {
    return null;
  }

  // Deriva una clave de 32 bytes de forma determinista a partir del valor dado.
  return crypto.scryptSync(raw, "documentacion-cred-salt", 32);
}

function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function encryptSecret(plainText) {
  const text = String(plainText ?? "");
  const key = getKey();
  if (!key || !text) {
    return text;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(stored) {
  const value = String(stored ?? "");
  if (!isEncrypted(value)) {
    // Valor en texto plano (o vacio): se devuelve tal cual.
    return value;
  }

  const key = getKey();
  if (!key) {
    // Esta cifrado pero no hay clave: no se puede descifrar.
    return "";
  }

  try {
    const [, , ivB64, tagB64, dataB64] = value.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

function hasEncryptionKey() {
  return Boolean(getKey());
}

module.exports = {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  hasEncryptionKey,
};
