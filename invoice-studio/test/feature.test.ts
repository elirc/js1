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
  const client = (await call("/api/clients")).data[0];
  return {
    clientId: client.id,
    status: "draft",
    issuedDate: "2028-02-29",
    taxRate: 10,
    items: [{ description: "Lesson", quantity: 2, unitPrice: 0.1 }],
  };
}
test("invoice totals use validated line inputs and preserve calendar dates", async () => {
  const made = await call("/api/invoices", "POST", await fixture());
  assert.equal(made.status, 201);
  assert.equal(made.data.issuedDate, "2028-02-29");
  assert.equal(made.data.subtotal, 0.2);
  assert.equal(made.data.tax, 0.02);
  assert.equal(made.data.total, 0.22);
});
test("invalid dates, whole quantities and nested values are rejected before replacing lines", async () => {
  const input = await fixture(),
    made = await call("/api/invoices", "POST", input),
    path = "/api/invoices/" + made.data.id;
  for (const bad of [
    { issuedDate: "2027-02-29" },
    { taxRate: "Infinity" },
    { taxRate: 101 },
    { items: [null] },
    { items: [{ description: "bad", quantity: 1.5, unitPrice: 2 }] },
    { items: [{ description: "bad", quantity: [1], unitPrice: 2 }] },
    { items: [{ description: "bad", quantity: 1, unitPrice: 0.001 }] },
  ])
    assert.equal(
      (await call(path, "PUT", { ...input, ...bad })).status,
      400,
      JSON.stringify(bad),
    );
  assert.deepEqual((await call(path)).data, made.data);
});
test("a database failure after line deletion restores the original invoice and lines", async () => {
  const input = await fixture(),
    made = await call("/api/invoices", "POST", input),
    path = "/api/invoices/" + made.data.id;
  await h.admin.query(
    "CREATE FUNCTION reject_invoice_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description='Fail after delete' THEN RAISE EXCEPTION 'injected line failure'; END IF; RETURN NEW; END $$",
  );
  await h.admin.query(
    "CREATE TRIGGER reject_invoice_line BEFORE INSERT ON invoice_items FOR EACH ROW EXECUTE FUNCTION reject_invoice_line()",
  );
  try {
    assert.equal(
      (
        await call(path, "PUT", {
          ...input,
          items: [
            { description: "Fail after delete", quantity: 1, unitPrice: 2 },
          ],
        })
      ).status,
      500,
    );
    assert.deepEqual((await call(path)).data, made.data);
  } finally {
    await h.admin.query("DROP TRIGGER reject_invoice_line ON invoice_items");
  }
});

test("two units at 12.34 with zero tax total 24.68, and the total is stored to the cent", async () => {
  const client = (await call("/api/clients")).data[0];
  const made = await call("/api/invoices", "POST", {
    clientId: client.id, status: "draft", issuedDate: "2028-02-29", taxRate: 0,
    items: [{ description: "Lesson", quantity: 2, unitPrice: 12.34 }],
  });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const read = (await call("/api/invoices/" + made.data.id)).data;
  assert.equal(read.total, 24.68);
  assert.equal(read.issuedDate, "2028-02-29");
});
