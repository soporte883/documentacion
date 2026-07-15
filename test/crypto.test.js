const test = require("node:test");
const assert = require("node:assert");

process.env.CREDENTIALS_ENC_KEY = "clave-de-prueba-para-tests-1234567890";
const { encryptSecret, decryptSecret, isEncrypted } = require("../api/_lib/crypto");

test("encrypt/decrypt hace round-trip correcto", () => {
  const original = "SuperClave123!";
  const encrypted = encryptSecret(original);
  assert.ok(isEncrypted(encrypted), "debe tener prefijo enc:");
  assert.notStrictEqual(encrypted, original);
  assert.strictEqual(decryptSecret(encrypted), original);
});

test("decrypt devuelve texto plano tal cual (compatibilidad)", () => {
  assert.strictEqual(decryptSecret("textoPlano"), "textoPlano");
  assert.strictEqual(isEncrypted("textoPlano"), false);
});

test("cadena vacia se mantiene vacia", () => {
  assert.strictEqual(encryptSecret(""), "");
  assert.strictEqual(decryptSecret(""), "");
});

test("dos cifrados del mismo texto son distintos (IV aleatorio)", () => {
  const a = encryptSecret("igual");
  const b = encryptSecret("igual");
  assert.notStrictEqual(a, b);
  assert.strictEqual(decryptSecret(a), "igual");
  assert.strictEqual(decryptSecret(b), "igual");
});
