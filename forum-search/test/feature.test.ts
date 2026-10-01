import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database, request } from "./database.js";
let h;
before(async () => {
  h = await database();
});
after(async () => {
  if (h) await h.close();
});
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
test("search plus tag filtering retains totals when requesting a page beyond the end", async () => {
  const user = (await call("/api/users")).data[0];
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await call("/api/threads", "POST", {
          title: "Astraforum paging",
          body: "Astraforum explains stable SQL pagination.",
          authorId: user.id,
          tagNames: [" Lesson ", "lesson"],
        })
      ).status,
      201,
    );
  const query = "/api/threads?q=Astraforum&tag=lesson&pageSize=2";
  const first = (await call(query)).data,
    again = (await call(query)).data;
  assert.equal(first.total, 3);
  assert.deepEqual(
    first.items.map((x) => x.id),
    again.items.map((x) => x.id),
  );
  const last = (await call(query + "&page=999")).data;
  assert.equal(last.total, 3);
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 1);
  const empty = (await call("/api/threads?q=absentfixture&page=999")).data;
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1);
});
test("malformed nested tags and author references do not create partial threads", async () => {
  const user = (await call("/api/users")).data[0],
    input = {
      title: "Validation lesson",
      body: "Some text",
      authorId: user.id,
      tagNames: ["lesson"],
    };
  const count = Number(
    (await h.admin.query("SELECT COUNT(*) AS n FROM threads")).rows[0].n,
  );
  for (const bad of [
    { tagNames: [{}] },
    { tagNames: [""] },
    { authorId: "bad" },
    { authorId: randomUUID() },
    { title: 4 },
  ])
    assert.equal(
      (await call("/api/threads", "POST", { ...input, ...bad })).status,
      400,
    );
  assert.equal(
    Number(
      (await h.admin.query("SELECT COUNT(*) AS n FROM threads")).rows[0].n,
    ),
    count,
  );
});

test("deleting the only row on the last page clamps the next read to the previous page", async () => {
  const user = (await call("/api/users")).data[0];
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const made = await call("/api/threads", "POST", { title: "Clampfixture " + i, body: "Clampfixture body", authorId: user.id, tagNames: ["clamp"] });
    assert.equal(made.status, 201);
    ids.push(made.data.id);
  }
  const query = "/api/threads?q=Clampfixture&tag=clamp&pageSize=5";
  const second = (await call(query + "&page=2")).data;
  assert.equal(second.total, 6);
  assert.equal(second.items.length, 1);
  assert.equal((await call("/api/threads/" + second.items[0].id, "DELETE")).status, 204);
  const again = (await call(query + "&page=2")).data;
  assert.equal(again.total, 5);
  assert.equal(again.page, 1);
  assert.equal(again.items.length, 5);
});
