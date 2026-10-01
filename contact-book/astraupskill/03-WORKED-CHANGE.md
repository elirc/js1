# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** The form checked required fields but allowed two contacts with the same email. A naive uniqueness check would also reject an unchanged email while editing its owner.

**After:** Creates and edits reject case-insensitive, whitespace-normalized duplicates in another record. The message identifies the existing contact, marks the email invalid for assistive technology, focuses it, and leaves stored data unchanged.

## Predict this example

Ada owns Ada@Example.com. Creating Other with " ada@example.COM " fails. Editing Ada’s phone while keeping Ada@Example.com succeeds. Changing Bob’s email to ADA@example.com fails.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 69. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function saveContact(event) {
  event.preventDefault();

  const contact = {
    id: idInput.value || crypto.randomUUID(),
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    company: companyInput.value.trim(),
    relationship: relationshipInput.value
  };

  if (!contact.name || !contact.email || !contact.phone) {
    setMessage("Name, email, and phone are required.");
    return;
  }

  const duplicate = contacts.find((item) =>
    item.id !== editingId && item.email.trim().toLowerCase() === contact.email.toLowerCase()
  );
  if (duplicate) {
    setMessage(`A contact with this email already exists: ${duplicate.name}.`);
    emailInput.setAttribute("aria-invalid", "true");
    emailInput.focus();
    return;
  }
  emailInput.removeAttribute("aria-invalid");

  const next = editingId
    ? contacts.map((item) => item.id === editingId ? contact : item)
    : [contact, ...contacts];

  // Validation passed. Persist before publishing, and keep the form usable if the write fails.
  if (!commitContacts(next)) return;

  setMessage(editingId ? "Contact updated." : "Contact added.");
  resetForm();
  renderContacts();
}
```

### The changed lines, isolated

The function above is mostly pre-existing code. Diff it against `AstraOrganized2/astrafinalplan/implementation/backups/02/app.js` and only two regions come back.

**The uniqueness guard** (new, `app.js:86-95`) - this was the delivered change:

```javascript
  const duplicate = contacts.find((item) =>
    item.id !== editingId && item.email.trim().toLowerCase() === contact.email.toLowerCase()
  );
  if (duplicate) {
    setMessage(`A contact with this email already exists: ${duplicate.name}.`);
    emailInput.setAttribute("aria-invalid", "true");
    emailInput.focus();
    return;
  }
  emailInput.removeAttribute("aria-invalid");
```

**The write boundary** (`app.js:56-67` and `:97-102`) - this was added in the 2026-09-17 follow-up, because the course's own chapter 2 promised a failure boundary the project did not have. Before:

```javascript
function persistContacts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}
```

After:

```javascript
function commitContacts(next) {
  try {
    // Persist first. A quota/security error must not leave the screen showing
    // a contact that will disappear on the next reload.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    setMessage("Could not save. Your contacts are unchanged.");
    return false;
  }
  contacts = next;
  return true;
}
```

Read the two together and notice they are the *same idea applied twice*. The uniqueness guard refuses to mutate on invalid input; `commitContacts` refuses to publish on a failed write. Both put the rejection before the point of no return, and both leave the caller able to fix the problem and retry - which is why `resetForm()` is now only reached on the success path (`app.js:105`). `deleteContact` (`app.js:125-131`) went through the same treatment, so a quota error no longer removes a contact from the screen that is still in storage.

## Three variations to work through

Run each against the Ada/Bob fixture in [test/duplicates.test.cjs](../test/duplicates.test.cjs). State this app's matching policy out loud first, because two of the three are only surprising if you forget it: **the key is `email.trim().toLowerCase()`, not RFC 5321 email equality.** This app does not know that some providers ignore dots, or that the local part is case-*sensitive* per the RFC, or that `ada+tag@` routes to the same mailbox.

**Variation 1 - the plus-tag address.** Ada owns `Ada@Example.com`. Create a contact with `ada+work@example.com`. Predicted: **accepted**, two contacts, both of which almost certainly reach the same human. `key('ada+work@example.com')` is not `key('ada@example.com')`, and nothing in `app.js:86-88` knows about subaddressing. Decide deliberately whether that is a bug: normalising plus-tags away would silently merge two records for users of providers that treat them as distinct.

**Variation 2 - the Turkish dotted capital I.** Ada owns `Ada@Example.com`. Create `ADA@EXAMPLE.COM` with a Turkish capital I: `ADA@EXAMPLE.COM` where the I is `U+0130` (`İ`). `'İ'.toLowerCase()` is `'i̇'` - the letter plus a combining dot above, two code points - so the strings do not compare equal and the contact is **accepted**. `toLowerCase()` is locale-independent in JavaScript but not identity-preserving. If you need this, the comparison key is `email.trim().normalize('NFKC').toLowerCase()`; add it and re-run all four tests to prove the ordinary cases still behave.

**Variation 3 - trailing dot and trailing whitespace.** Create `ada@example.com.` (trailing dot) and separately ` ada@example.com ` (surrounding spaces). Predicted: the trailing dot is **accepted** (a different string after trimming), the surrounding spaces are **rejected** - and test 1 already proves the second half by submitting `" ada@example.COM "` and asserting `localStorage.getItem(KEY)` is byte-identical to the fixture. Note what "byte-identical" buys you over checking the error message: it proves nothing was written *and* that no unrelated field was silently re-serialized.

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Normalization and validation answer different questions. Normalization chooses a comparison form; validation decides whether a candidate obeys a rule. Lowercasing here is a documented address-book policy, not a claim that every email provider treats all addresses identically. Do not add provider-specific dot removal or plus-address stripping: those transformations would merge potentially distinct addresses. The self-exclusion rule is the central edit insight: an existing contact is not a duplicate of itself. Comparing ids makes that distinction reliable even if the user changes the name or email. A useful validation error protects data and helps the person recover; a red outline alone is insufficient. The current array scan is linear in contact count, which is appropriate for this small local directory. A server-backed version would also require a database uniqueness strategy because two concurrent requests can both pass an application-only check.

## Executable examples

These are the first two of the four regression tests in [test/duplicates.test.cjs](../test/duplicates.test.cjs); cases 3 and 4 force a failing `Storage.prototype.setItem` on the create and delete paths. Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
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
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
