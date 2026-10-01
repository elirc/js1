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
async function fixture() {
  const agents = (await call("/api/agents")).data,
    labels = (await call("/api/labels")).data;
  return {
    subject: "Astra support lesson",
    body: "Explain one transaction",
    priority: "normal",
    assigneeId: agents[0].id,
    labelIds: labels.slice(0, 1).map((x) => x.id),
  };
}
test("repeated status and assignment commands record only actual changes", async () => {
  const made = await call("/api/tickets", "POST", await fixture());
  assert.equal(made.status, 201);
  const path = "/api/tickets/" + made.data.id;
  const result = await Promise.all([
    call(path + "/status", "PATCH", { status: "resolved" }),
    call(path + "/status", "PATCH", { status: "resolved" }),
  ]);
  assert.deepEqual(
    result.map((x) => x.status),
    [200, 200],
  );
  await call(path + "/assignee", "PATCH", { assigneeId: null });
  await call(path + "/assignee", "PATCH", { assigneeId: null });
  const events = (await call(path + "/events")).data;
  assert.equal(events.filter((x) => x.kind === "status").length, 1);
  assert.equal(events.filter((x) => x.kind === "assignment").length, 1);
});
test("a late invalid label reference rolls back edits and earlier label deletion", async () => {
  const input = await fixture(),
    made = await call("/api/tickets", "POST", input),
    path = "/api/tickets/" + made.data.id;
  const changed = await call(path, "PUT", {
    ...input,
    subject: "Must roll back",
    labelIds: [randomUUID()],
  });
  assert.equal(changed.status, 400);
  assert.deepEqual((await call(path)).data, made.data);
  assert.equal((await call(path + "/events")).data.length, 1);
  assert.equal(
    (await call("/api/tickets", "POST", { ...input, subject: {} })).status,
    400,
  );
});
test("an audit write failure cannot commit a ticket status change", async () => {
  const made = await call("/api/tickets", "POST", await fixture()),
    path = "/api/tickets/" + made.data.id;
  await h.admin.query(
    "CREATE FUNCTION reject_ticket_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='status' THEN RAISE EXCEPTION 'injected log failure'; END IF; RETURN NEW; END $$",
  );
  await h.admin.query(
    "CREATE TRIGGER reject_ticket_log BEFORE INSERT ON ticket_events FOR EACH ROW EXECUTE FUNCTION reject_ticket_log()",
  );
  try {
    assert.equal(
      (await call(path + "/status", "PATCH", { status: "closed" })).status,
      500,
    );
    assert.deepEqual((await call(path)).data, made.data);
  } finally {
    await h.admin.query("DROP TRIGGER reject_ticket_log ON ticket_events");
  }
});
