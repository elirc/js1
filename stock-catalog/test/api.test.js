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
  name: "Astraproduct tie",
  category: "Learning",
  price: 12.5,
  stock: 2,
};
test("equal sort values have stable page boundaries and invalid page numbers normalize", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal((await call("/api/products", "POST", valid)).status, 201);
  const query = "/api/products?search=Astraproduct&sort=price&pageSize=2";
  const first = (await call(query)).data,
    again = (await call(query)).data;
  assert.deepEqual(
    first.items.map((x) => x.id),
    again.items.map((x) => x.id),
  );
  assert.equal(first.total, 3);
  const last = (await call(query + "&page=999")).data;
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 1);
  const malformed = (await call("/api/products?page=Infinity&pageSize=2.5"))
    .data;
  assert.equal(malformed.page, 1);
  assert.equal(malformed.pageSize, 5);
});
test("bad numeric/text values cannot replace a valid product", async () => {
  const made = await call("/api/products", "POST", valid);
  for (const bad of [
    { price: "Infinity" },
    { price: "" },
    { price: true },
    { stock: 1.5 },
    { name: {} },
    { stock: null },
  ])
    assert.equal(
      (await call("/api/products/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
    );
});

test("page size is clamped when valid and defaulted when malformed", async () => {
  assert.equal((await call("/api/products?pageSize=500")).data.pageSize, 50);
  assert.equal((await call("/api/products?pageSize=0")).data.pageSize, 5);
  assert.equal((await call("/api/products?pageSize=2.5")).data.pageSize, 5);
  assert.equal((await call("/api/products?pageSize=7")).data.pageSize, 7);
});
