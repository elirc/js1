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
  title: "Astra priority lesson",
  status: "Backlog",
  priority: "High",
  assignee: "Junior",
  description: "Priority and status are independent.",
};
test("priority, status and search filters compose without changing records", async () => {
  await call("/api/issues", "POST", valid);
  await call("/api/issues", "POST", { ...valid, priority: "Low" });
  await call("/api/issues", "POST", { ...valid, status: "Done" });
  const rows = (
    await call("/api/issues?search=Astra&status=Backlog&priority=High")
  ).data;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].priority, "High");
  assert.equal(rows[0].status, "Backlog");
  assert.equal((await call("/api/issues?priority=Unknown")).status, 400);
});
test("malformed issue text cannot overwrite existing details", async () => {
  const made = await call("/api/issues", "POST", valid);
  for (const bad of [{ title: {} }, { assignee: [] }, { description: 42 }])
    assert.equal(
      (await call("/api/issues/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
    );
  assert.deepEqual((await call("/api/issues/" + made.data.id)).data, made.data);
});

test("search and priority compose to zero matches, and URL-encoded text is decoded before matching", async () => {
  assert.equal((await call("/api/issues", "POST", { ...valid, title: "Rendering & layout glitch", priority: "Critical" })).status, 201);
  const none = (await call("/api/issues?search=Rendering&priority=Low")).data;
  assert.equal(none.length, 0);
  const some = (await call("/api/issues?search=" + encodeURIComponent("Rendering & layout") + "&priority=Critical")).data;
  assert.equal(some.length, 1);
  assert.equal(some[0].title, "Rendering & layout glitch");
});
