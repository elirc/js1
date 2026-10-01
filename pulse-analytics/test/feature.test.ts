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
test("daily analytics fill missing calendar days and include exactly the requested window", async () => {
  await h.admin.query("TRUNCATE events");
  await h.admin.query(
    "INSERT INTO events(name,product,amount,occurred_at) VALUES ('purchase','Fixture',100,CURRENT_DATE-3),('purchase','Fixture',10,CURRENT_DATE-2),('purchase','Fixture',30,CURRENT_DATE)",
  );
  assert.equal((await call("/api/metrics/refresh", "POST", {})).status, 200);
  const daily = (await call("/api/metrics/daily?days=3")).data;
  assert.equal(daily.length, 3);
  assert.deepEqual(
    daily.map((x) => x.revenue),
    [10, 0, 30],
  );
  assert.deepEqual(
    daily.map((x) => x.revenueCumulative),
    [10, 10, 40],
  );
  assert.deepEqual(
    daily.map((x) => x.revenueMa7),
    [10, 5, 13.33],
  );
  assert.deepEqual(
    daily.map((x) => x.revenueDelta),
    [null, -10, 30],
  );
  const summary = (await call("/api/metrics/summary?days=3")).data;
  assert.equal(summary.revenue, 40);
  assert.equal(summary.orders, 2);
});
test("invalid event values never reach the raw event table", async () => {
  const before = Number(
    (await h.admin.query("SELECT COUNT(*) AS n FROM events")).rows[0].n,
  );
  for (const body of [
    { name: "purchase", product: "Fixture", amount: "Infinity" },
    { name: "purchase", product: "Fixture", amount: null },
    { name: "view", product: {} },
    { name: "unknown", product: "Fixture" },
  ])
    assert.equal((await call("/api/events", "POST", body)).status, 400);
  assert.equal(
    Number((await h.admin.query("SELECT COUNT(*) AS n FROM events")).rows[0].n),
    before,
  );
});
test("freshness reports the gap between raw events and the refreshed view", async () => {
  const added = await call("/api/events", "POST", {
    name: "view",
    product: "Fixture",
    amount: 0,
  });
  assert.equal(added.status, 201);
  assert.equal(added.data.stale, true);
  const refreshed = await call("/api/metrics/refresh", "POST", {});
  assert.equal(refreshed.data.stale, false);
});

test("a seven-day window returns seven rows even when events exist on two days", async () => {
  await h.admin.query("TRUNCATE events");
  await h.admin.query(
    "INSERT INTO events(name,product,amount,occurred_at) VALUES ('purchase','Fixture',5,CURRENT_DATE-6),('purchase','Fixture',7,CURRENT_DATE)",
  );
  assert.equal((await call("/api/metrics/refresh", "POST", {})).status, 200);
  const daily = (await call("/api/metrics/daily?days=7")).data;
  assert.equal(daily.length, 7);
  assert.deepEqual(daily.map((x) => x.revenue), [5, 0, 0, 0, 0, 0, 7]);
  assert.equal(daily.filter((x) => x.revenue === 0).length, 5);
});
test("an event with an unknown name is rejected by the vocabulary rule first", async () => {
  const r = await call("/api/events", "POST", { name: "refund", product: 5, amount: "x" });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /view, add_to_cart, or purchase/);
});
