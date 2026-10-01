# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Credentials and note text are typed and bounded, email normalization is consistent, and an owned note detail endpoint completes the read path. Owner checks protect read, update and delete; logout revokes its token.

The key model is: Users and tokens are Maps; notes are an array with id, userId, title, body and createdAt. A Bearer token selects a user. Passwords are salted and hashed with scrypt. All data and sessions disappear on server restart.

The worked fixture should behave as follows: User A creates Learning note. User B sees an empty note list and receives 404 for A's detail, edit and delete paths. An invalid body leaves the old note intact. After A logs out, the old token receives 401.

## Extension solutions

### Exercise 1

**Prompt:** Show an explicit empty-note state after login.

**Approach:** Distinguish an empty successful list from a failed request; do not display no notes while authentication is still loading.

**Review:** the empty state must be distinguishable from a failed request and from a not-yet-loaded list: show the three UI states in your test or screenshot, and prove that a 401 during the initial `refresh()` signs the user out instead of rendering an empty list.

### Exercise 2

**Prompt:** Add a last-edited timestamp that changes only after a valid update.

**Approach:** Keep createdAt stable and set updatedAt only at the successful mutation boundary. Test rejected edits do not touch it.

**Review:** `updatedAt` must change only on a successful `PUT` (set it right where the note is mutated in `server/server.js`); a rejected edit (title too short) must leave both `updatedAt` and the fields unchanged, and `createdAt` must never change; your test should compare the whole note object before and after the rejected edit.

### Exercise 3

**Prompt:** Test a failed login followed by a successful login.

**Approach:** Keep the generic invalid-credentials response and confirm a malformed input does not terminate the process.

**Review:** the failed login must return the generic `Invalid email or password.` for a wrong password and for an unknown email alike, must not issue a token, and must not lock or alter the account; the following successful login must produce a token that works on `/api/auth/me`; add the malformed-body case (`{ email: 5 }`) and assert the process is still serving afterwards.

### Exercise 4

**Prompt:** Move users, tokens and notes into persistent storage.

**Approach:** Create owner foreign keys, use parameterized queries and keep owner predicates on every record operation. Design session expiration and password hashing capacity explicitly.

**Review:** your design must name the owner foreign key on `notes`, show every note query carrying `WHERE user_id = $1`, store sessions with `expires_at` and delete expired rows, and keep password hashing (`scrypt` with a per-user salt) exactly as it is now; explain what `findOwnedNote` becomes in SQL and why a 404 is still the right answer for a foreign note.

### Exercise 7 — 404 or 403: choose deliberately

Reference test:

```javascript
test("a foreign note and a missing note are indistinguishable", async () => {
  const mine = (await api("/notes", "POST", { title: "Private", body: "" }, a)).data;
  for (const method of ["GET", "PUT", "DELETE"]) {
    const body = method === "PUT" ? { title: "Taken over", body: "" } : undefined;
    const foreign = await api("/notes/" + mine.id, method, body, b);
    const missing = await api("/notes/00000000-0000-4000-8000-000000000000", method, body, b);
    assert.deepEqual({ s: foreign.status, d: foreign.data }, { s: missing.status, d: missing.data });
  }
  assert.equal((await api("/notes/" + mine.id, "GET", undefined, a)).data.title, "Private");
});
```

Review: the point is not that 403 is always wrong (a shared-workspace app where members can see each other's ids may prefer it) but that the choice leaks or hides existence. Your write-up must say which information the 404 hides, and must show that the check still happens on the server even though the client never lists foreign ids.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/notes.test.js](../test/notes.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Object-valued credentials and note fields could reach string or password operations. Reading a single owned note had no dedicated endpoint. I changed the implementation so that: Credentials and note text are typed and bounded, email normalization is consistent, and an owned note detail endpoint completes the read path. Owner checks protect read, update and delete; logout revokes its token. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
