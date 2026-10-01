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
