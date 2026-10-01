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
test("self and descendant moves are rejected while moving back to a root is supported", async () => {
  const a = await call("/api/nodes", "POST", {
    name: "Astra root",
    title: "Root",
    parentId: null,
  });
  assert.equal(a.status, 201);
  const b = await call("/api/nodes", "POST", {
    name: "Astra child",
    title: "Child",
    parentId: a.data.id,
  });
  assert.equal(b.status, 201);
  assert.equal(
    (
      await call("/api/nodes/" + a.data.id + "/move", "PATCH", {
        newParentId: b.data.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/nodes/" + a.data.id + "/move", "PATCH", {
        newParentId: a.data.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/nodes/" + b.data.id + "/move", "PATCH", {
        newParentId: null,
      })
    ).status,
    200,
  );
  assert.equal((await call("/api/nodes/" + b.data.id)).data.depth, 0);
});
test("opposing concurrent moves cannot introduce a cycle", async () => {
  const a = await call("/api/nodes", "POST", {
      name: "Concurrent A",
      title: "",
      parentId: null,
    }),
    b = await call("/api/nodes", "POST", {
      name: "Concurrent B",
      title: "",
      parentId: null,
    });
  const results = await Promise.all([
    call("/api/nodes/" + a.data.id + "/move", "PATCH", {
      newParentId: b.data.id,
    }),
    call("/api/nodes/" + b.data.id + "/move", "PATCH", {
      newParentId: a.data.id,
    }),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 400]);
  const aa = (await call("/api/nodes/" + a.data.id)).data,
    bb = (await call("/api/nodes/" + b.data.id)).data;
  assert.equal(aa.depth + bb.depth, 1);
  assert.equal((await call("/api/tree")).status, 200);
});
test("invalid or nonexistent parent references leave the hierarchy unchanged", async () => {
  const a = await call("/api/nodes", "POST", {
    name: "Reference test",
    title: "",
    parentId: null,
  });
  assert.equal(
    (await call("/api/nodes/" + a.data.id + "/move", "PATCH", {})).status,
    400,
  );
  assert.equal(
    (
      await call("/api/nodes/" + a.data.id + "/move", "PATCH", {
        newParentId: randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal((await call("/api/nodes/" + a.data.id)).data.depth, 0);
  assert.equal((await call("/api/nodes/invalid")).status, 400);
});
