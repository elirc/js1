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
  code: "astra-101",
  title: "Astra lesson",
  instructor: "Junior Mentor",
  capacity: 4,
  enrolled: 2,
  level: "Beginner",
};
test("normalized course codes are unique while an unchanged code can be edited", async () => {
  const made = await call("/api/courses", "POST", valid);
  assert.equal(made.status, 201);
  assert.equal(made.data.code, "ASTRA-101");
  assert.equal(
    (await call("/api/courses", "POST", { ...valid, code: " ASTRA-101 " }))
      .status,
    409,
  );
  const edited = await call("/api/courses/" + made.data.id, "PUT", {
    ...valid,
    title: "Updated lesson",
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.id, made.data.id);
});
test("counts must be finite whole numbers and enrollment cannot exceed capacity", async () => {
  for (const bad of [
    { capacity: "bad" },
    { capacity: 1.5 },
    { enrolled: -1 },
    { enrolled: 5 },
    { enrolled: null },
    { title: {} },
    { level: "Unknown" },
  ])
    assert.equal(
      (
        await call("/api/courses", "POST", {
          ...valid,
          code: "astra-invalid",
          ...bad,
        })
      ).status,
      400,
      JSON.stringify(bad),
    );
});

test("a fresh server instance starts from the seed, not from another instance's writes", async () => {
  // Closing and re-listening the same module keeps its arrays; only a new module instance
  // (or a new process) reseeds. The query string defeats the ES module cache.
  const seeded = (await call("/api/courses")).data.length;
  assert.equal((await call("/api/courses", "POST", { ...valid, code: "restart-1" })).status, 201);
  assert.equal((await call("/api/courses")).data.length, seeded + 1);
  const fresh = await import(new URL("../server/server.js", import.meta.url).href + "?instance=" + Date.now());
  const server = fresh.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    const freshList = (await request(origin, "/api/courses")).data;
    assert.ok(freshList.length < seeded + 1, "a fresh instance does not see writes made to another instance");
    assert.ok(!freshList.some((c) => c.code === "RESTART-1"), "the course created above is absent in the fresh instance");
  } finally {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
});
