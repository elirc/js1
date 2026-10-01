# Trace lab: Secure Notes: owned CRUD and runtime boundaries

[Course index](README.md) · [Worked change](03-WORKED-CHANGE.md) · [Tests](04-TESTING-AND-DEBUGGING.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## The concrete case

This lab connects one visible action to the code that accepts or rejects it. Use a disposable dataset and write your prediction before running the operation. The goal is to explain what each boundary contributes, not to memorize a sequence of clicks.

User A creates Learning note. User B sees an empty note list and receives 404 for A's detail, edit and delete paths. An invalid body leaves the old note intact. After A logs out, the old token receives 401.

## Write the record before touching the form

Users and tokens are Maps; notes are an array with id, userId, title, body and createdAt. A Bearer token selects a user. Passwords are salted and hashed with scrypt. All data and sessions disappear on server restart.

Make a small table in your own notes with these columns: field, starting value, proposed value, and source of truth. Include identity even when the form does not display it. Include related rows or stored counters when the operation changes more than one fact. Mark a value as derived if the app recomputes it rather than storing it independently.

For example, an edit can change a title while preserving an ID. A status command can keep the same status while producing no new history. An import can contain many rows yet be rejected before any replacement begins. In each case, the meaningful observation is the promised resulting state. A success toast alone cannot establish which fields changed.

## Trace the real call path

### Boundary 1 — the React form decides what to send

`client/src/App.jsx`: the auth card's `handleSubmit` (line 53) posts `{ email, password }` to `register` or `login`; the notes panel's `handleSubmit` (line 134) sends `form` (`title`, `body`) to `createNote` or `updateNote` depending on `editingId`, then `reset()` and `refresh()`. `remove(id)` (line 161) calls `deleteNote`. No note or credential is validated in the browser; every rejection arrives as `error.message` from the server.

### Boundary 2 — the client serializes the request and attaches the session

`client/src/api.js`: `login`/`register` store the returned `token` in `localStorage` under `js1-secure-notes-token` via `setToken`; every later call goes through `request()`, which adds `Authorization: Bearer <token>` when a token exists, sets the JSON header, and throws `Error(data.error)` on non-2xx. A 401 anywhere is turned into a sign-out on the client. Nothing else identifies the user: the token is the whole identity.

### Boundary 3 — the middleware chain validates the caller and the input

`server/server.js:16` rejects any write whose body is not a JSON object. `requireAuth` (line 141) reads the bearer token, looks it up in `tokens`, rejects a missing or expired session with 401, and attaches `req.user`. `validateNote` (line 157) then bounds `body` (string, at most 20,000) and `title` (2-200 characters). Register and login normalize the email (`trim().toLowerCase()`, lines 32 and 66) so `" A@example.com "` and `a@example.com` are the same account. All of this happens before any note is touched.

### Boundary 4 — the handler applies the owner-scoped change

`findOwnedNote(id, userId)` (line 187) is the whole authorization model: `notes.find(n => n.id === id && n.userId === userId)`. `GET /api/notes/:id` (line 94, the new endpoint), `PUT` (line 112) and `DELETE` (line 122) all call it and answer 404 `Note not found.` when it returns nothing, deliberately the same answer for a missing note and for someone else's note. `POST` (line 100) stamps `userId: req.user.id` from the session, ignoring anything the body says.

### Boundary 5 — the storage boundary commits or rejects

State is three in-memory structures: `users` (Map by email), `tokens` (Map by token) and the `notes` array. `PUT` mutates the found note object in place; `DELETE` splices it out; `POST` unshifts. Each handler runs synchronously to completion, so no other request can observe a half-applied change within one process. Restarting the server forgets every user, token and note; the trade-offs of moving this to a database are exercise 4.

### Boundary 6 — the response tells the client what actually happened

`POST` answers 201 with the note; `PUT` 200 with the mutated note; `DELETE` 204 with no body (`api.js` returns `null` for 204); `login` and `register` answer with `{ token, expiresAt, user }`. The client then calls `refresh()` and re-reads `/api/notes`, which is filtered by `notesFor(req.user.id)`, so the list you see is always the server's owner-scoped view, never the client's guess.

## Predict the regression scenarios

| Scenario from the executable suite | Prediction to write before running |
|---|---|
| malformed auth input is rejected without crashing the server | Initial records, request/input, expected result, and records that must remain unchanged. |
| owner can create, read, edit and delete; another user cannot see or change the note | Initial records, request/input, expected result, and records that must remain unchanged. |
| invalid note edits preserve the stored note, logout revokes access | Initial records, request/input, expected result, and records that must remain unchanged. |

Open the test file and identify the arrange, act and assert portions. Arrange creates the synthetic starting state. Act calls the real boundary. Assert reads the observable result. Some tests repeat a call or issue two calls together; explain why a single ordinary call would miss that defect. Tests may share a deliberate fixture within one suite, so read setup and earlier scenario state before copying one case into a standalone script.

## A successful request, described precisely

Start with a valid fixture from the test. Copy the values into your own learning notes rather than copying a personal record. State which fields are required, which may be omitted and which have a special meaning when empty. Execute the operation once. Compare the response with a fresh authoritative read, then compare the UI with that read. If the UI is still loading, wait for the actual expected condition instead of guessing a fixed delay.

Record the stable ID and one changed field. Record at least one field that must remain the same. If the operation creates a child, record the parent ID stored on the child. If it updates an aggregate, compute the expected aggregate by hand. If it restores a backup, count retained, ignored and recreated records according to this project’s documented policy. These observations make a small example reusable when the implementation changes.

## A rejected request, described precisely

Now change one value to a rejected case named in the test suite. Keep everything else identical. Predict where validation fails. Run it and capture both the feedback and the authoritative state afterward. Compare the saved record, related rows and relevant counters with their pre-request values. A controlled error is useful only if the application also preserves the intended state.

Do not assume that all failures have the same status or message. Invalid input, missing records, conflicts and infrastructure errors represent different conditions. Read this app’s handler or parser to see the actual result. Browser-only parsers return a success/error union or throw an import error rather than returning an HTTP status. Translate the same correctness idea into the contract this app actually exposes.

## Read the storage boundary

The server memory owns records. Use the Network panel to compare request JSON and response JSON, then restart the API to distinguish process memory from durable storage. The regression helper imports the actual app and calls it through HTTP.

Place a breakpoint immediately before the first write and another after the final write or publish step. On the success path, note what changed between those points. On the rejected-input path, the first write should never be reached when validation promises pre-write rejection. On a transactional failure path, some statements may execute and then roll back; reaching a write statement does not mean its effect committed.

An await marks a place where another operation can run. It does not itself define a transaction. When the test uses Promise.all, sketch request A and request B in two columns. Show where each acquires a lock or reads state. The test should accept either winner while insisting on the same final invariant. For synchronous or browser-only validation, explain why concurrency is outside the tested function rather than borrowing a database explanation that does not apply.

## Explain the design tradeoff

Authentication asks which user the request represents. Authorization asks whether that user may access this note. Finding a note by ID alone is insufficient: the owner predicate must also match. Returning the same 404 for a missing and another user's note keeps the response consistent. The test signs in as two different users and tries each operation rather than merely inspecting the middleware name.

TypeScript is not involved in this JavaScript server, and even TypeScript types would not validate network JSON. A password object must fail before scryptSync. Email normalization trims and lowercases before looking up the same map key for register and login. Passwords are not trimmed, because spaces are part of the user's chosen credential.

The title has a 2–200 character rule; the body is text up to 20,000 characters. Validation happens before the note mutates. This is a small authentication teaching app, with in-memory sessions, open CORS and synchronous hashing. Persistent accounts, rate limits, session expiration and deployment configuration remain separate improvements.

## Change one requirement independently

**Practice task:** Show an explicit empty-note state after login.

Before implementation, write three acceptance criteria: an ordinary successful case, a rejected or cancelled case, and a case that preserves existing behavior. Identify the smallest file boundary that owns the rule. Keep the existing regression suite; add a test only when it observes a new promise. Do not reproduce the implementation line by line inside the assertion, because both copies can contain the same mistake.

After a first attempt, compare your design with this hint: Distinguish an empty successful list from a failed request; do not display no notes while authentication is still loading.

## Debug a disagreement between layers

If the form and response disagree, inspect the request payload before editing the database code. If the response and database disagree, inspect the mapper, transaction and read query. If a test fails before an HTTP request is logged, inspect startup, environment variables and the test fixture. Missing dependencies, a busy port or an unavailable database are different from a failed business assertion. Preserve the first useful error and fix that cause before interpreting later cascading failures.

When a date looks wrong, distinguish a calendar label from an instant and check the serialization boundary. When an optional field will not clear, distinguish omission from an explicit empty/null value. When a list seems to lose a record, inspect filtering, sorting and pagination before assuming deletion. When history duplicates, compare desired-state commands with commands that represent a new event. These are diagnostic questions to apply to the actual fields above.

## Final independent checkpoint

Close this guide and give a five-minute walkthrough using only the application source and one test. Explain the user-visible problem, the input contract, the identity model, the write boundary, a failed operation and the remaining limitation. Then modify the worked fixture and predict the result without running it. Reopen the guide only after writing your answer.

A useful review note includes the exact command run, its result, and the boundary it covers. Keep browser interaction, simulated storage tests, real HTTP/database tests and compile checks distinct. The [verification page](VERIFICATION.md) records this delivery’s evidence. Exercises and proposed extensions in this course remain learner work; they are not counted as implemented features.
