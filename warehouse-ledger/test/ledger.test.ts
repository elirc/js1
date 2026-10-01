import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, request } from "./database.js";
let h: Awaited<ReturnType<typeof database>>,
  product: string,
  main: string,
  other: string;
before(async () => {
  h = await database();
  product = (await h.admin.query("SELECT id FROM products WHERE sku='SKU-001'"))
    .rows[0].id;
  main = (await h.admin.query("SELECT id FROM warehouses WHERE name='Main'"))
    .rows[0].id;
  other = (
    await h.admin.query("SELECT id FROM warehouses WHERE name='Overflow'")
  ).rows[0].id;
});
after(async () => {
  if (h) await h.close();
});
const api = (path: string, body: unknown) =>
  request(h.origin, "/api/" + path, "POST", body);
test("fractional, nonnumeric, unbounded and malformed quantities leave stock unchanged", async () => {
  const count = await h.admin.query("SELECT count(*) FROM movements");
  for (const delta of [1.2, "3", 0, 2147483648, null])
    assert.equal(
      (await api("movements", { productId: product, warehouseId: main, delta }))
        .status,
      400,
    );
  assert.equal(
    (
      await api("movements", {
        productId: product,
        warehouseId: main,
        delta: 1,
        reason: {},
      })
    ).status,
    400,
  );
  assert.deepEqual(
    (await h.admin.query("SELECT count(*) FROM movements")).rows,
    count.rows,
  );
});
test("two simultaneous issues cannot both spend the same stock", async () => {
  const results = await Promise.all(
    [1, 2].map(() =>
      api("movements", { productId: product, warehouseId: main, delta: -30 }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  assert.equal(
    Number(
      (
        await h.admin.query(
          "SELECT sum(delta) AS n FROM movements WHERE product_id=$1 AND warehouse_id=$2",
          [product, main],
        )
      ).rows[0].n,
    ),
    10,
  );
});
test("transfer conserves stock; a late failure rolls the debit back", async () => {
  await h.admin.query(
    `CREATE FUNCTION reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'force failure' AND NEW.delta > 0 THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_credit BEFORE INSERT ON movements FOR EACH ROW EXECUTE FUNCTION reject_credit();`,
  );
  const count = (await h.admin.query("SELECT count(*) FROM movements")).rows;
  assert.equal(
    (
      await api("transfers", {
        productId: product,
        fromWarehouseId: main,
        toWarehouseId: other,
        quantity: 3,
        reason: "force failure",
      })
    ).status,
    500,
  );
  assert.deepEqual(
    (await h.admin.query("SELECT count(*) FROM movements")).rows,
    count,
  );
  assert.equal(
    (
      await api("transfers", {
        productId: product,
        fromWarehouseId: main,
        toWarehouseId: other,
        quantity: 3,
      })
    ).status,
    201,
  );
  assert.equal(
    Number(
      (
        await h.admin.query(
          "SELECT sum(delta) AS n FROM movements WHERE product_id=$1",
          [product],
        )
      ).rows[0].n,
    ),
    10,
  );
});
