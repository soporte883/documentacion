// Helpers de validacion y saneamiento compartidos por los endpoints.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_TEXT_LENGTH = 5000;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length > 0 && email.length <= 320 && EMAIL_REGEX.test(email);
}

function isStrongEnoughPassword(value) {
  return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH;
}

function isValidRole(value) {
  return value === "admin" || value === "user";
}

// Solo permite URLs http/https. Bloquea javascript:, data:, etc. (anti-XSS).
function isSafeHttpUrl(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return false;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function withinLength(value, max = MAX_TEXT_LENGTH) {
  return String(value ?? "").length <= max;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_TEXT_LENGTH,
  normalizeText,
  normalizeEmail,
  isValidEmail,
  isStrongEnoughPassword,
  isValidRole,
  isSafeHttpUrl,
  withinLength,
};
