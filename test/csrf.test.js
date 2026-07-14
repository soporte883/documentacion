const test = require("node:test");
const assert = require("node:assert/strict");

const { createCsrfToken, isValidCsrf, CSRF_HEADER } = require("../api/_lib/csrf");

function fakeReq(cookieToken, headerToken) {
  const headers = {};
  if (cookieToken !== undefined) {
    headers.cookie = `doc_csrf=${cookieToken}; other=1`;
  }
  if (headerToken !== undefined) {
    headers[CSRF_HEADER] = headerToken;
  }
  return { headers };
}

test("createCsrfToken genera token hex de 64 chars", () => {
  const token = createCsrfToken();
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("isValidCsrf acepta cuando cookie y header coinciden", () => {
  const token = createCsrfToken();
  assert.equal(isValidCsrf(fakeReq(token, token)), true);
});

test("isValidCsrf rechaza cuando no coinciden", () => {
  assert.equal(isValidCsrf(fakeReq("aaa", "bbb")), false);
});

test("isValidCsrf rechaza cuando falta cookie o header", () => {
  const token = createCsrfToken();
  assert.equal(isValidCsrf(fakeReq(token, undefined)), false);
  assert.equal(isValidCsrf(fakeReq(undefined, token)), false);
  assert.equal(isValidCsrf(fakeReq(undefined, undefined)), false);
});
