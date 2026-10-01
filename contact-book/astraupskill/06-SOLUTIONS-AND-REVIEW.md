# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Creates and edits reject case-insensitive, whitespace-normalized duplicates in another record. The message identifies the existing contact, marks the email invalid for assistive technology, focuses it, and leaves stored data unchanged.

The key model is: A contact has id, name, email, phone, company and relationship. Email comparison uses trim().toLowerCase(), but the displayed email retains the user’s spelling. The unique key for editing remains id, not email.

The worked fixture should behave as follows: Ada owns Ada@Example.com. Creating Other with " ada@example.COM " fails. Editing Ada’s phone while keeping Ada@Example.com succeeds. Changing Bob’s email to ADA@example.com fails.

## Extension solutions

### Exercise 1

**Prompt:** Clear the duplicate message when the user corrects the address, without hiding unrelated errors.

**Approach:** `app.js:48` already clears `aria-invalid` on every keystroke in the email field, but it does not clear the *message*, and clearing the message unconditionally would erase "Name, email, and phone are required." while the user is still missing a phone number. Track which field the current error belongs to.

```javascript
let activeError = null;   // null | "required" | "duplicate"

function setMessage(text, kind = null) {
  message.textContent = text;
  activeError = kind;
}

emailInput.addEventListener("input", () => {
  emailInput.removeAttribute("aria-invalid");
  if (activeError === "duplicate") setMessage("", null);   // only this error is stale
});
```

Then call `setMessage("Name, email, and phone are required.", "required")` at `app.js:82` and `setMessage(\`A contact with this email already exists: ${duplicate.name}.\`, "duplicate")` at `app.js:90`.

**Review:** The naive implementation is `emailInput.addEventListener("input", () => setMessage(""))`, and the case that breaks it is: submit with a name and an email but no phone (message: "Name, email, and phone are required."), then type one more character into the email field. The required-fields message vanishes while the form is still invalid, and the user has no idea what is wrong. Write that as a regression before you write the fix. The invariant that must not move: `aria-invalid` is still removed on every keystroke and on every successful save (`app.js:95`, `:132`), because a stale `aria-invalid` is worse than a stale message - assistive technology announces the field as invalid when it may no longer be.

### Exercise 2

**Prompt:** Add a case-insensitive company filter without mutating stored company names.

**Approach:** `getFilteredContacts` (`app.js:141-146`) already lowercases a concatenation of every field, which means a search for `labs` matches a *name* containing "labs" too. A company filter is a separate, narrower predicate over the same normalized-comparison / original-storage split.

```javascript
let companyFilter = "";   // normalized; "" means no filter

const companyKey = (value) => (value ?? "").trim().toLowerCase();

function getFilteredContacts() {
  return contacts.filter((contact) => {
    const searchable = `${contact.name} ${contact.email} ${contact.phone} ${contact.company} ${contact.relationship}`.toLowerCase();
    const matchesCompany = !companyFilter || companyKey(contact.company) === companyFilter;
    return matchesCompany && searchable.includes(searchTerm);
  });
}

// Options are derived, never stored: one normalized key, one display spelling.
function companyOptions() {
  const seen = new Map();                       // key -> first spelling seen
  for (const contact of contacts) {
    const key = companyKey(contact.company);
    if (key && !seen.has(key)) seen.set(key, contact.company.trim());
  }
  return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
}
```

**Review:** The ordinary case is two contacts at `Northwind Labs` and one at `northwind labs `; both must appear under one option, and both stored `company` strings must still read exactly as they were typed after the filter is applied - assert that, not just the visible count. The naive implementation writes the normalized value back (`contact.company = companyKey(contact.company)`), which passes every filter test and quietly destroys the user's capitalization; that is the same "normalize for comparison, store the original" rule the email guard follows at `app.js:87`, where `item.email.trim().toLowerCase()` is computed per comparison and never assigned. The invariant that remains unchanged: filtering is derived state recomputed by `renderContacts`, so there is still exactly one array of contacts and no second list to keep in sync.

### Exercise 3

**Prompt:** Implement a duplicate-review screen for legacy contacts already sharing an email.

**Approach:** Use the *same* key function as the write guard - if the review screen and the guard disagree, you will show conflicts that cannot happen and miss ones that can. Build the index once per render rather than scanning `contacts` for every contact, which also answers the "normalized-key index" question this course raises: the guard's `contacts.find(...)` at `app.js:86` is an O(n) scan per save, fine for a personal address book and wrong for ten thousand rows.

```javascript
const emailKey = (email) => email.trim().toLowerCase();

// One pass. Map key -> contacts sharing it. Reused by both the guard and the review screen.
function emailIndex(list = contacts) {
  const index = new Map();
  for (const contact of list) {
    const key = emailKey(contact.email);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(contact);
  }
  return index;
}

function duplicateGroups() {
  return [...emailIndex()].filter(([, group]) => group.length > 1);
}

// The guard, rewritten against the index. Same policy, O(1) lookup.
function findDuplicate(candidateEmail) {
  const group = emailIndex().get(emailKey(candidateEmail)) ?? [];
  return group.find((item) => item.id !== editingId) ?? null;
}
```

The screen itself lists each group and offers exactly two actions per group: *keep both* (records the decision so the group stops being reported) and *merge into this one* (copies chosen fields, then deletes the others through `commitContacts` in a **single** write, so a failure leaves every record present).

**Review:** The ordinary case is a storage value seeded with `Ada@Example.com` and `ada@example.com`; the screen must report exactly one group of two, and the app must still be fully usable - editing either record's phone number succeeds, because `item.id !== editingId` excludes only the record under edit. The implementation that breaks is the tempting one: merge automatically on load. Demonstrate why it is wrong with a fixture where the two records have different phone numbers - whichever one you drop, you have destroyed data the user never agreed to lose, and you did it during a page load with no undo. The invariant that remains unchanged: a merge is still one `localStorage.setItem` through `commitContacts`, so a half-merged state cannot be stored; assert it by patching `setItem` to throw mid-merge and checking that `contacts.length` is unchanged.

### Exercise 4

**Prompt:** Design the corresponding server-side uniqueness constraint.

**Approach:** Two layers, and the point of the exercise is that you need both.

```sql
-- Layer 1: the database is the only place uniqueness can actually be guaranteed.
CREATE UNIQUE INDEX contacts_email_key
  ON contacts (lower(btrim(email)));
```

```javascript
// Layer 2: the application check, for a good message. It is a courtesy, not the guarantee.
async function createContact(input) {
  const existing = await db("contacts").whereRaw("lower(btrim(email)) = lower(btrim(?))", [input.email]).first();
  if (existing) throw new ConflictError(`A contact with this email already exists: ${existing.name}.`);
  try {
    return await db("contacts").insert(input).returning("*");
  } catch (error) {
    // 23505 = unique_violation. Two requests can both pass the check above.
    if (error.code === "23505") throw new ConflictError("A contact with this email already exists.");
    throw error;
  }
}
```

Map `ConflictError` to **409**, not 400: the request was well-formed, it lost a race with the current state.

**Review:** The current guarantee is "no two contacts in *this tab's* array share a key at the moment of saving". The stronger guarantee is "no two rows in the table ever share a key". The failure mode the change introduces is the one the trace lab already names: two concurrent requests both run `find`/`SELECT`, both see nothing, both insert, and one gets a `23505` from the database *after* passing validation - so the error path is no longer purely a validation path and must translate a driver error code into a user-facing message. Demonstrate it by removing the `catch` and running two inserts concurrently: the user gets a 500 for a condition the product has a perfectly good answer for. The invariant that remains unchanged: the comparison policy. `lower(btrim(email))` in the index must match `email.trim().toLowerCase()` in the application exactly, or the database will reject records the application accepted, and neither will be explainable. Write down the collation you are relying on; this is also where the `İ` case from chapter 3 comes back, because Postgres `lower()` and JavaScript `toLowerCase()` do not agree on every code point.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/duplicates.test.cjs](../test/duplicates.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: The form checked required fields but allowed two contacts with the same email. A naive uniqueness check would also reject an unchanged email while editing its owner. I changed the implementation so that: Creates and edits reject case-insensitive, whitespace-normalized duplicates in another record. The message identifies the existing contact, marks the email invalid for assistive technology, focuses it, and leaves stored data unchanged. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
