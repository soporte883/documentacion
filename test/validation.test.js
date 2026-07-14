const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidEmail,
  isStrongEnoughPassword,
  isValidRole,
  isSafeHttpUrl,
  normalizeEmail,
  normalizeText,
} = require("../api/_lib/validation");

test("isValidEmail acepta correos validos", () => {
  assert.equal(isValidEmail("user@fundacionluker.org.co"), true);
  assert.equal(isValidEmail("a.b-c@dominio.com"), true);
});

test("isValidEmail rechaza correos invalidos", () => {
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("sin-arroba"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("a @b.com"), false);
});

test("isStrongEnoughPassword exige 8+ caracteres", () => {
  assert.equal(isStrongEnoughPassword("1234567"), false);
  assert.equal(isStrongEnoughPassword("12345678"), true);
  assert.equal(isStrongEnoughPassword(12345678), false);
});

test("isValidRole solo admin o user", () => {
  assert.equal(isValidRole("admin"), true);
  assert.equal(isValidRole("user"), true);
  assert.equal(isValidRole("superuser"), false);
  assert.equal(isValidRole(""), false);
});

test("isSafeHttpUrl bloquea protocolos peligrosos", () => {
  assert.equal(isSafeHttpUrl("https://ejemplo.com"), true);
  assert.equal(isSafeHttpUrl("http://ejemplo.com/x"), true);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,<script>"), false);
  assert.equal(isSafeHttpUrl("ftp://host"), false);
  assert.equal(isSafeHttpUrl(""), false);
});

test("normalizeEmail y normalizeText normalizan espacios/mayusculas", () => {
  assert.equal(normalizeEmail("  USER@X.COM "), "user@x.com");
  assert.equal(normalizeText("  hola  "), "hola");
});
