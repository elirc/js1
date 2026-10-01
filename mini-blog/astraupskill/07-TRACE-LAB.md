# Trace lab: relationships and validated text boundaries

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/server.js](../server/server.js) and [test/api.test.js](../test/api.test.js) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

A comment under A cannot be deleted through B. Deleting A removes access to its comments. Object-valued text returns 400 and creates no comment.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the form decides what to send

`client/src/App.jsx`: a post form (`title`, `author`, `body`) and a comment form under the selected post (`author`, `text`).

### Boundary 2 — the request leaves the browser

`client/src/api.js`: `POST /api/posts`, `POST /api/posts/:id/comments`, `DELETE /api/posts/:postId/comments/:commentId`.

### Boundary 3 — the middleware validates each level

`validatePost` and `validateComment` (`server/server.js:79`, `:94`): one `isText` gate each with bounds; the nested routes then check the parent exists (`findPost`) before listing or adding.

### Boundary 4 — the repository applies the change

`createBlogRepository()` (line 106): `addComment(postId, body)` returns `null` when the parent is missing (-> 404); `removePost(id)` filters both arrays, which is the array-store form of a cascade.

### Boundary 5 — the storage boundary is process memory

two module-level arrays; restart reseeds; synchronous handlers, no interleaving.

### Boundary 6 — the response tells the client what happened

201 with the comment, 404 for an unknown parent or a mismatched parent/comment pair, 204 for deletes; the client re-fetches the comment list of the open post.

## Expected observations

| Action or input | Expected result |
|---|---|
| Comment C belongs to post B | B/C is the valid pair |
| Delete C through post A | C remains on B |
| Delete post B | Its comments are removed |
| Object comment body | Controlled validation error |
| Author text | Descriptive label, not authenticated identity |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

/posts/A/comments/C asserts that C belongs to A. Finding C alone ignores that relationship. The repository already checks both ids; the test makes that guarantee explicit.

Client types do not validate incoming JSON. Check strings before trimming and bound body size at the API boundary. Rejecting a malformed child should not change the parent count. Deleting a parent and validating child text are separate responsibilities: one describes relationship policy, the other acceptable input. Learn both by observing stored collections after each request.

Pause near `validateComment` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- nested comments belong to one parent and deleting it removes its children
- object-valued text produces a clear validation response without saving a comment

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
