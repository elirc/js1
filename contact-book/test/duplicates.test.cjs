const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");
const KEY = "js1-contact-book";
const contacts = [
  {
    id: "a",
    name: "Ada",
    email: "Ada@Example.com",
    phone: "123",
    company: "",
    relationship: "Friend",
  },
  {
    id: "b",
    name: "Bob",
    email: "bob@example.com",
    phone: "456",
    company: "",
    relationship: "Client",
  },
];
test("case/whitespace duplicate create and conflicting edit leave storage untouched", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(contacts) });
  for (const [selector, value] of [
    ["#name", "Other"],
    ["#email", " ada@example.COM "],
    ["#phone", "789"],
  ])
    app.document.querySelector(selector).value = value;
  app.event("#contact-form", "submit");
  assert.equal(app.w.localStorage.getItem(KEY), JSON.stringify(contacts));
  assert.equal(
    app.document.querySelector("#email").getAttribute("aria-invalid"),
    "true",
  );
  app.evaluate("editContact('b')");
  app.document.querySelector("#email").value = "ADA@example.com";
  app.event("#contact-form", "submit");
  assert.equal(app.w.localStorage.getItem(KEY), JSON.stringify(contacts));
  app.close();
});
test("editing your own email and adding a distinct email both succeed after reload", async () => {
  let app = await openApp({ [KEY]: JSON.stringify(contacts) });
  app.evaluate("editContact('a')");
  app.document.querySelector("#name").value = "Ada Updated";
  app.event("#contact-form", "submit");
  assert.equal(
    JSON.parse(app.w.localStorage.getItem(KEY))[0].name,
    "Ada Updated",
  );
  const saved = app.snapshot();
  app.close();
  app = await openApp(saved);
  for (const [selector, value] of [
    ["#name", "Cara"],
    ["#email", "cara@example.com"],
    ["#phone", "789"],
  ])
    app.document.querySelector(selector).value = value;
  app.event("#contact-form", "submit");
  assert.equal(JSON.parse(app.w.localStorage.getItem(KEY)).length, 3);
  app.close();
});
test("a failed write adds no contact, keeps the form populated and leaves storage byte-identical", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(contacts) });
  for (const [selector, value] of [
    ["#name", "Cara"],
    ["#email", "cara@example.com"],
    ["#phone", "789"],
  ])
    app.document.querySelector(selector).value = value;
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); };",
  );
  app.event("#contact-form", "submit");
  assert.equal(app.evaluate("contacts.length"), 2);
  assert.equal(app.w.localStorage.getItem(KEY), JSON.stringify(contacts));
  assert.equal(app.document.querySelector("#name").value, "Cara");
  assert.match(
    app.document.querySelector("#message").textContent,
    /Could not save/,
  );
  app.close();
});
test("a failed write does not delete a contact", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(contacts) });
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); }; deleteContact('a')",
  );
  assert.equal(app.evaluate("contacts.length"), 2);
  assert.equal(app.w.localStorage.getItem(KEY), JSON.stringify(contacts));
  assert.match(
    app.document.querySelector("#message").textContent,
    /Could not save/,
  );
  app.close();
});
