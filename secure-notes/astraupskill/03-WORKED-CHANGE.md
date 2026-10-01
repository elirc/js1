# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Object-valued credentials and note fields could reach string or password operations. Reading a single owned note had no dedicated endpoint.

**After:** Credentials and note text are typed and bounded, email normalization is consistent, and an owned note detail endpoint completes the read path. Owner checks protect read, update and delete; logout revokes its token.

## Predict this example

User A creates Learning note. User B sees an empty note list and receives 404 for A's detail, edit and delete paths. An invalid body leaves the old note intact. After A logs out, the old token receives 401.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The lines below are the ones Astra changed (compare `AstraOrganized2/astrafinalplan/implementation/batch04/backups/56/server/server.js` with `diff --strip-trailing-cr -w`): the JSON-object guard, the normalized email and bounded password in `register` (and the same normalization in `login`), the new owner-scoped `GET /api/notes/:id`, and the bounded `validateNote`. `requireAuth` and `findOwnedNote` were already there; session expiry was added in this course's fix pass (see chapter 2). The linked source is authoritative if you later edit the project.

```javascript
app.use((req, res, next) => {
  if (
    ["POST", "PUT", "PATCH"].includes(req.method) &&
    (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
  )
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

app.post("/api/auth/register", (req, res) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body.password;
  if (!isEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email." });
  }
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    password.length > 128
  ) {
    return res
      .status(400)
      .json({ error: "Password must contain 6–128 characters." });

app.get("/api/notes/:id", requireAuth, (req, res) => {
  const note = findOwnedNote(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "Note not found." });
  res.json(note);
});

function validateNote(req, res, next) {
  if (
    req.body.body !== undefined &&
    (typeof req.body.body !== "string" || req.body.body.length > 20000)
  )
    return res
      .status(400)
      .json({ error: "Body must be text of at most 20,000 characters." });
  if (
    typeof req.body.title !== "string" ||
    req.body.title.trim().length < 2 ||
    req.body.title.trim().length > 200
  ) {
    return res
      .status(400)
      .json({ error: "Title must contain 2–200 characters." });
  }
  next();
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Authentication asks which user the request represents. Authorization asks whether that user may access this note. Finding a note by ID alone is insufficient: the owner predicate must also match. Returning the same 404 for a missing and another user's note keeps the response consistent. The test signs in as two different users and tries each operation rather than merely inspecting the middleware name.

TypeScript is not involved in this JavaScript server, and even TypeScript types would not validate network JSON. A password object must fail before scryptSync. Email normalization trims and lowercases before looking up the same map key for register and login. Passwords are not trimmed, because spaces are part of the user's chosen credential.

The title has a 2–200 character rule; the body is text up to 20,000 characters. Validation happens before the note mutates. This is a small authentication teaching app, with in-memory sessions, open CORS and synchronous hashing. Persistent accounts, rate limits, session expiration and deployment configuration remain separate improvements.

## Three variations to work through

**Normal variation — the same account, two spellings.** Register with `" A@example.com "` then log in with `a@example.com`. Predict: both succeed and `GET /api/auth/me` shows `a@example.com`. Then register `a@example.com` again: predict 409 `That email is already registered.` Point at the two lines in `server/server.js` that make the spellings equal.

**Invalid variation — a body that is not an object.** `PUT /api/notes/:id` with the JSON body `[]`, then with `{ title: "x" }`. Predict the two status codes and messages (400 `Send a JSON object.` from the guard at line 16; 400 `Title must contain 2-200 characters.` from `validateNote`), then `GET` the note and deep-equal it against the original: zero fields changed.

**Boundary variation — another user's note.** With user B's token, `GET`, `PUT` and `DELETE` user A's note. Predict 404 for all three and that A's note is intact afterwards. Then read exercise 7 to see why the answer is 404 and not 403, and what an attacker would learn if it were 403.

## Executable examples

These are the actual regression tests in [test/notes.test.js](../test/notes.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
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
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
