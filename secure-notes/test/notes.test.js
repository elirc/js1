import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { application } from "./http.js";
let h, a, b;
async function api(path, method = "GET", body, token) {
  const r = await fetch(h.origin + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}
before(async () => {
  h = await application();
  a = (
    await api("/auth/register", "POST", {
      email: " A@example.com ",
      password: "learn123",
    })
  ).data.token;
  b = (
    await api("/auth/register", "POST", {
      email: "b@example.com",
      password: "learn123",
    })
  ).data.token;
});
after(async () => h.close());
test("malformed auth input is rejected without crashing the server", async () => {
  for (const password of [{}, [], 3, "x".repeat(129)])
    assert.equal(
      (
        await api("/auth/register", "POST", {
          email: "bad@example.com",
          password,
        })
      ).status,
      400,
    );
  assert.equal(
    (await api("/auth/login", "POST", { email: {}, password: [] })).status,
    401,
  );
  assert.equal(
    (
      await api("/auth/login", "POST", {
        email: "A@example.com",
        password: "learn123",
      })
    ).status,
    200,
  );
});
test("owner can create, read, edit and delete; another user cannot see or change the note", async () => {
  const r = await api(
    "/notes",
    "POST",
    { title: "Learning note", body: "Original" },
    a,
  );
  assert.equal(r.status, 201);
  const path = "/notes/" + r.data.id;
  for (const method of ["GET", "PUT", "DELETE"])
    assert.equal(
      (
        await api(
          path,
          method,
          method === "PUT" ? { title: "Stolen" } : undefined,
          b,
        )
      ).status,
      404,
    );
  assert.deepEqual((await api("/notes", "GET", undefined, b)).data, []);
  assert.equal(
    (await api(path, "PUT", { title: "Edited", body: "Saved" }, a)).status,
    200,
  );
  assert.equal((await api(path, "GET", undefined, a)).data.body, "Saved");
  assert.equal((await api(path, "DELETE", undefined, a)).status, 204);
  assert.equal((await api(path, "GET", undefined, a)).status, 404);
});
test("invalid note edits preserve the stored note, logout revokes access", async () => {
  const r = await api(
    "/notes",
    "POST",
    { title: "Keep me", body: "Original" },
    a,
  );
  const path = "/notes/" + r.data.id;
  for (const body of [
    { title: 3 },
    { title: "Okay", body: {} },
    { title: "x".repeat(201) },
  ])
    assert.equal((await api(path, "PUT", body, a)).status, 400);
  assert.equal((await api(path, "GET", undefined, a)).data.body, "Original");
  assert.equal((await api("/auth/logout", "POST", {}, a)).status, 204);
  assert.equal((await api("/notes", "GET", undefined, a)).status, 401);
});

test("an expired session is rejected and removed; logging in again works", async () => {
  process.env.SESSION_TTL_MS = "40";
  const short = (
    await api("/auth/login", "POST", { email: "b@example.com", password: "learn123" })
  ).data;
  delete process.env.SESSION_TTL_MS;
  assert.ok(short.expiresAt);
  assert.equal((await api("/auth/me", "GET", undefined, short.token)).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const expired = await api("/auth/me", "GET", undefined, short.token);
  assert.equal(expired.status, 401);
  assert.equal(expired.data.error, "Session expired. Sign in again.");
  assert.equal((await api("/auth/logout", "POST", {}, short.token)).status, 401);
  const fresh = (
    await api("/auth/login", "POST", { email: "b@example.com", password: "learn123" })
  ).data;
  assert.equal((await api("/auth/me", "GET", undefined, fresh.token)).status, 200);
});
