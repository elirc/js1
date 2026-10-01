# Trace lab: duplicate emails during creation and editing

[Course index](README.md)

## Choose the comparison rule

This app trims outside whitespace and compares lowercase email strings. It preserves display spelling. This is the application's matching policy, not a claim about every email provider's account rules.

```javascript
const key = email => email.trim().toLowerCase();
key(' Maya@Example.com ') === key('maya@example.com'); // true
```

Suppose record 11 contains Maya's email and record 12 contains Lin's. Adding a new record with MAYA@example.com must fail. Renaming record 11 while keeping its email must succeed. Changing record 12 to Maya's email must fail.

This reduced pattern excludes the current record. Without that exclusion, every unchanged-email edit finds itself and looks like a duplicate. Find the actual implementation and representation of a new-contact editing id in [app.js](../app.js) - it is `idInput.value` at `app.js:73` and the module-level `editingId` at `app.js:23`.

## The six boundaries of one save

A browser-only app has the same boundaries as an API; they are all in one file. Walk them in order with [app.js](../app.js) open and write down what enters and leaves each one.

**1. The input surface (DOM) - `index.html` + `app.js:26-49`.** Six form controls plus a hidden `#contact-id` that carries identity, and two per-card buttons bound inside `renderContacts` (`app.js:167-168`) that carry only an id. `#contact-id` is the boundary's most interesting field: it is empty for a create and populated by `editContact` (`app.js:113`) for an edit, and it is what makes one handler serve both operations. Nothing here validates or stores.

**2. Normalization - `saveContact`, `app.js:72-79`.** Raw control values become a domain record. Four fields are trimmed; `relationship` is taken from a `<select>` and trusted for its bounded vocabulary; `id` is `idInput.value || crypto.randomUUID()`, which is both a normalization and a decision. Trimming is normalization, not validation: it changes a value it is going to accept. Note that the trimming here is *stored*, while the trimming at line 87 is only used for comparison - that distinction is the whole "normalize for comparison, store the original" lesson.

**3. Required-field validation - `app.js:81-84`.** The cheap, context-free rejection: name, email and phone must be non-empty after trimming. It does not consult other contacts and it does not touch storage. Answer the standing question - has anything been written yet? No.

**4. The uniqueness rule - `app.js:86-95`.** This is the layer the course exists for, and it is different in kind from layer 3: it is a rule about the *collection*, not about the value, so it needs to read existing state. `contacts.find(item => item.id !== editingId && ...)` scans the array with the comparison key `trim().toLowerCase()`. The `item.id !== editingId` term is the exclusion that stops a record matching itself - delete it and every unchanged-email edit reports a duplicate against its own record. On rejection this layer also owns the user-recovery details: message, `aria-invalid`, and focus. Still nothing written.

```javascript
const duplicate = contacts.some(contact =>
  contact.id !== editingId && key(contact.email) === key(candidateEmail)
);
```

**5. The persistence boundary - `commitContacts`, `app.js:56-67`, called from `app.js:102` and `:125`.** One function, one `localStorage.setItem`, for create, edit and delete. `JSON.stringify(next)` serializes the whole array into a single string, and the array `next` built at lines 97-99 is a *replacement*, never a mutation of `contacts` - so if the write throws, the replacement is simply discarded and there is nothing to roll back. This is where a transaction would be in a database project, and the analogy is exact: the atomicity comes from the storage primitive, not from the `try` block around it. Confirm the ordering yourself - `contacts = next` is line 65, *after* `setItem` returned.

**6. Publication and render - `app.js:104-106`.** The success message, `resetForm` (which clears `editingId` and `aria-invalid`) and `renderContacts`, which recomputes the visible list from `contacts` through `getFilteredContacts` (`app.js:141`). None of these is a second source of truth; the count at line 151 and the empty state at line 152 are both derived per render. Ask the last question of this layer: what does a repeated call do? `renderContacts()` is idempotent. `saveContact` is not - submitting twice after a successful create is rejected by layer 4 as a duplicate of the record you just made, which is the check doing its job.

Now trace one failure backwards. Patch `Storage.prototype.setItem` to throw and submit a valid new contact (test 3 does exactly this). Which layer observed the failure? Five. Which reported it? Five, through `setMessage`. Which never ran? Six - and that is why the form still holds "Cara" and the user can press save again. Compare that with a rejection from layer 4, where layers 5 and 6 never run and the form also stays populated. Two different failures, same recovery affordance, reached by different paths.

## Validate before mutation

A visible error does not prove rejection happened before saving. Compare the contact count and stored values before and after the rejected action - test 1 asserts `localStorage.getItem(KEY)` is byte-identical to the fixture string, which is stronger than a count, because it also proves no unrelated field was re-serialized. Moving validation after an array mutation would require rollback and complicate the failure path.

The invalid email field receives focus and `aria-invalid` (`app.js:91-92`); the message is in the `#message` element. Correct the address and explain where the stale invalid state is cleared - there are three places: the `input` listener at `app.js:48`, the success path at `app.js:95`, and `resetForm` at `app.js:133`. These details help keyboard and assistive-technology users recover.

For a future server, two concurrent requests could both pass an array-like duplicate check. A uniqueness constraint on the chosen normalized representation would provide a separate database safeguard - see exercise 4's solution in chapter 6 for the `CREATE UNIQUE INDEX ... (lower(btrim(email)))` and the 23505 translation. First understand this local boundary before extending it.
