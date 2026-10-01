# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same request chapter 03 runs; send it after your change and compare the response to the expected observations in chapter 03:

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

## Existing implementation

Posts and comments require bounded text before repository methods run. Tests verify existing parent-scoped deletion and cascade behavior. The client mount and static labels are repaired.

The key model is: Posts and comments are separate arrays. Each comment has postId. Nested routes provide the parent context. Data is in memory; deleting a post removes its comments.

The worked fixture should behave as follows: A comment under A cannot be deleted through B. Deleting A removes access to its comments. Object-valued text returns 400 and creates no comment.

## Extension solutions

### Exercise 1

**Prompt:** Add comment editing.

**Approach:** Match parent and comment ids before changing allowed fields; do not allow reassignment through an edit body.

**Review:** the edit must be looked up with both ids (`comment.id === commentId && comment.postId === postId`); the test must show 404 for the wrong parent with the comment unchanged and 200 for the right one.

### Exercise 2

**Prompt:** Show the comment character limit.

**Approach:** Use the documented maximum in the UI while keeping the API authoritative.

**Review:** the count must be derived at read time (no stored counter to drift) and the test must cover add, delete and post delete.

### Exercise 3

**Prompt:** Use a relational cascade.

**Approach:** Choose ON DELETE CASCADE only if that is the intended policy; verify transaction rollback.

**Review:** the failure must be injected between the two mutations and the test must assert the all-or-nothing outcome; explain why order (comments first, then post) makes the safe outcome the likely one in an array store.

### Exercise 4

**Prompt:** Page comments while retaining a total.

**Approach:** Count all children for the parent, order deterministically, then slice.

**Review:** the SQL note must show the foreign key with `ON DELETE CASCADE` and the scoped `UPDATE`; the test must prove the mismatched parent updates zero rows and the cascade removes comments.

### Exercise 7 — ownership and authorization

Reference: an actor middleware, `requireActor` on writes, `owner` stamped on `POST /api/posts` and `author` forced from the actor on comments, and owner comparisons before each mutation. Extend `request()` in `test/http.js` with a headers argument.

Review: the comment rule has two allowed actors; the test must cover both and a third party.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/api.test.js](../test/api.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Validators called trim on unverified values, producing server errors for object-valued post/comment text. I changed the implementation so that: Posts and comments require bounded text before repository methods run. Tests verify existing parent-scoped deletion and cascade behavior. The client mount and static labels are repaired. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
