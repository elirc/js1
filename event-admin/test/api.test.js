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
  name: "Astra event",
  location: "Learning room",
  date: "2028-02-29",
  capacity: 3,
  registered: 2,
  status: "Open",
};
test("real leap-day events round-trip and invalid edits preserve the event", async () => {
  const made = await call("/api/events", "POST", valid);
  assert.equal(made.status, 201);
  for (const bad of [
    { date: "2027-02-29" },
    { date: "2028-04-31" },
    { capacity: "bad" },
    { registered: 4 },
    { registered: 1.5 },
    { name: 12 },
  ])
    assert.equal(
      (await call("/api/events/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
      JSON.stringify(bad),
    );
  const all = (await call("/api/events")).data;
  assert.deepEqual(
    all.find((x) => x.id === made.data.id),
    made.data,
  );
});
test("full capacity is allowed but one registration beyond it is rejected", async () => {
  assert.equal(
    (await call("/api/events", "POST", { ...valid, registered: 3 })).status,
    201,
  );
  assert.equal(
    (await call("/api/events", "POST", { ...valid, registered: 4 })).status,
    400,
  );
});
