# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Validators called trim on unverified values, producing server errors for object-valued post/comment text.

**After:** Posts and comments require bounded text before repository methods run. Tests verify existing parent-scoped deletion and cascade behavior. The client mount and static labels are repaired.

## Predict this example

A comment under A cannot be deleted through B. Deleting A removes access to its comments. Object-valued text returns 400 and creates no comment.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The lines below are what remains after the fix pass: `validatePost` and `validateComment` are now one gate each (`isText` with bounds), and the nested comment route answers 404 when `addComment` finds no parent. Astra's delivered change was the type gate; the duplicated lower checks it left behind were removed here, so the worked example no longer prints dead code. Compare with `AstraOrganized2/astrafinalplan/implementation/batch03/backups/29/server/server.js`.

```javascript
// server/server.js:79
function validatePost(req, res, next) {
  const { title, author, body } = req.body;
  if (!isText(title,3) || !isText(author,2) || !isText(body,1,20000)) return res.status(400).json({ error: "Use bounded text for title, author and body." });
  next();
}

// server/server.js:85
function validateComment(req, res, next) {
  const { author, text } = req.body;
  if (!isText(author,2) || !isText(text,1,2000)) return res.status(400).json({ error: "Use an author name and comment text of at most 2000 characters." });
  next();
}

// server/server.js:59 (parent existence decided by the repository)
app.post("/api/posts/:id/comments", validateComment, (req, res) => {
  const comment = repository.addComment(req.params.id, req.body);
  if (!comment) {
    return res.status(404).json({ error: "Post not found." });
  }
  res.status(201).json(comment);
});
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

/posts/A/comments/C asserts that C belongs to A. Finding C alone ignores that relationship. The repository already checks both ids; the test makes that guarantee explicit.

Client types do not validate incoming JSON. Check strings before trimming and bound body size at the API boundary. Rejecting a malformed child should not change the parent count. Deleting a parent and validating child text are separate responsibilities: one describes relationship policy, the other acceptable input. Learn both by observing stored collections after each request.

## Three variations to work through

- **Normal variation — a comment on a real post.** `POST /api/posts/<id>/comments` with a valid body. Predict 201 and one more entry in `GET /api/posts/<id>/comments`.

- **Invalid variation — an orphan.** `POST /api/posts/does-not-exist/comments`. Predict 404 and no comment anywhere (the new third test counts). Then a comment with `text: ""`: predict 400 from the gate.

- **Boundary variation — the wrong parent.** Delete a comment through a URL that names a different post id. Predict 404 and the comment still present under its real parent; then delete the real parent and predict the comment list request is 404.

## Executable examples

These are the actual regression tests in [test/api.test.js](../test/api.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { application, request } from "./http.js";
let h;
before(async () => {
  h = await application();
});
after(async () => {
  if (h) await h.close();
});
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
const valid = {
  title: "Astra relationship lesson",
  author: "Mentor",
  body: "One post owns many comments.",
};
test("nested comments belong to one parent and deleting it removes its children", async () => {
  const one = await call("/api/posts", "POST", valid),
    two = await call("/api/posts", "POST", valid);
  const comment = await call(
    "/api/posts/" + one.data.id + "/comments",
    "POST",
    { author: "Junior", text: "A useful example" },
  );
  assert.equal(comment.status, 201);
  assert.equal(
    (
      await call(
        "/api/posts/" + two.data.id + "/comments/" + comment.data.id,
        "DELETE",
      )
    ).status,
    404,
  );
  assert.equal(
    (await call("/api/posts/" + one.data.id + "/comments")).data.length,
    1,
  );
  assert.equal((await call("/api/posts/" + one.data.id, "DELETE")).status, 204);
  assert.equal(
    (await call("/api/posts/" + one.data.id + "/comments")).status,
    404,
  );
});
test("object-valued text produces a clear validation response without saving a comment", async () => {
  assert.equal(
    (await call("/api/posts", "POST", { ...valid, title: {} })).status,
    400,
  );
  const made = await call("/api/posts", "POST", valid);
  for (const bad of [
    { author: 4, text: "hello" },
    { author: "Junior", text: {} },
    { author: "Junior", text: "x".repeat(2001) },
  ])
    assert.equal(
      (await call("/api/posts/" + made.data.id + "/comments", "POST", bad))
        .status,
      400,
    );
  assert.equal(
    (await call("/api/posts/" + made.data.id + "/comments")).data.length,
    0,
  );
});

test("comments are scoped to their parent post: unknown parents and mismatched ids are 404, and no orphan is written", async () => {
  const a = (await call("/api/posts", "POST", { title: "Parent A", author: "Sam", body: "a" })).data;
  const b = (await call("/api/posts", "POST", { title: "Parent B", author: "Sam", body: "b" })).data;
  const missing = await call("/api/posts/does-not-exist/comments", "POST", { author: "Jordan", text: "orphan" });
  assert.equal(missing.status, 404);
  const made = await call(`/api/posts/${a.id}/comments`, "POST", { author: "Jordan", text: "on A" });
  assert.equal(made.status, 201);
  // A valid comment id under the wrong parent must not be deletable.
  const wrongParent = await call(`/api/posts/${b.id}/comments/${made.data.id}`, "DELETE");
  assert.equal(wrongParent.status, 404);
  assert.equal((await call(`/api/posts/${a.id}/comments`)).data.length, 1);
  assert.equal((await call(`/api/posts/${b.id}/comments`)).data.length, 0);
  // Deleting the parent cascades: the comment list for A is gone with it.
  assert.equal((await call(`/api/posts/${a.id}`, "DELETE")).status, 204);
  assert.equal((await call(`/api/posts/${a.id}/comments`)).status, 404);
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
