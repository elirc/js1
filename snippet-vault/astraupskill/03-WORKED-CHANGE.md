# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** The store mutated before writing, duplicate tag variants accumulated, and rejected clipboard promises could escape without feedback.

**After:** Create, edit and delete publish only after persistence succeeds. Tags deduplicate case-insensitively, missing edit ids and blank content are rejected, and clipboard denial returns false so the UI can explain failure.

## Predict this example

Tags Utility,utility, EVENTS,events become Utility and EVENTS. A failed title-edit write leaves saved and in-memory titles unchanged. Clipboard rejection resolves false instead of producing an unhandled rejection.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [src/store.js](../src/store.js) near line 72 (it was line 59 before
the error-classification helper was added above it). It is a teaching snapshot; the linked source
is authoritative if you later edit the project. Read surrounding code for callers and setup.

**What changed here.** In
`AstraOrganized2/astrafinalplan/implementation/batch02/backups/17/src/store.js`, `saveSnippet`
published before it persisted and validated nothing:

```diff
 export function saveSnippet(input) {
   const base = {
     title: input.title.trim(),
     language: input.language,
     tags: parseTags(input.tags),
     code: input.code
   };
 
-  if (input.id) {
-    snippets = snippets.map((snippet) =>
-      snippet.id === input.id ? { ...snippet, ...base } : snippet
-    );
-  } else {
-    snippets.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...base });
-  }
-  persist();
+  if (!base.title || !base.code.trim()) throw new Error("Add a title and some code.");
+  if (input.id && !snippets.some((item) => item.id === input.id)) throw new Error("This snippet no longer exists.");
+  const next = input.id
+    ? snippets.map((snippet) => snippet.id === input.id ? { ...snippet, ...base } : snippet)
+    : [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...base }, ...snippets];
+  commit(next);
 }
```

and `persist`/`parseTags` changed with it:

```diff
-function persist() {
-  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
+function commit(next) {
+  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
+  snippets = next;
 }

 function parseTags(raw) {
-  return raw.split(",").map((tag) => tag.trim()).filter(Boolean);
+  const seen = new Set();
+  return raw.split(",").map((tag) => tag.trim()).filter((tag) => {
+    const key = tag.toLowerCase();
+    if (!key || seen.has(key)) return false;
+    seen.add(key);
+    return true;
+  });
 }
```

Read the old version twice. It mutated `snippets` **first** - by reassignment in the edit branch,
by `unshift` in the create branch - and called `persist()` **second**, so a quota failure left the
in-memory list showing a snippet that was not on disk: visible until reload, then gone. `commit`
(`store.js:31-34`) takes the candidate array as an argument, writes it, and only then assigns.
That swap is the entire lesson, and it is why the new code has to build `next` as an expression
rather than mutating in place.

Two more ideas arrived with it. Validation moved **into** the store - the old version would
happily save a blank title, and would silently create nothing at all when asked to edit an id
that no longer existed (`map` matches nothing and the write succeeds, so the user's edit
vanished with a success message). And `filter(Boolean)` dropped empty strings but kept `Utility`
and `utility` as two separate tags; `parseTags` (`store.js:36-44`) now keys on lower case while
preserving the first spelling seen.

```javascript
export function saveSnippet(input) {
  const base = {
    title: input.title.trim(),
    language: input.language,
    tags: parseTags(input.tags),
    code: input.code
  };

  if (!base.title || !base.code.trim()) throw new Error("Add a title and some code.");
  if (input.id && !snippets.some((item) => item.id === input.id)) throw new Error("This snippet no longer exists.");
  const next = input.id
    ? snippets.map((snippet) => snippet.id === input.id ? { ...snippet, ...base } : snippet)
    : [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...base }, ...snippets];
  commit(next);
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A useful module boundary owns a coherent responsibility. The store decides when data changes; rendering should not guess whether storage succeeded. Construct the candidate, write it and only then assign the module variable. If serialization or storage throws, assignment is skipped and the UI preserves the form. A Set of comparison keys removes duplicate tags while the first original spelling remains visible. Feature detection for navigator.clipboard is not permission: writeText may still reject, so the helper handles the asynchronous failure. Tests import actual ES modules under a fresh module identity for each fixture. Read methods still return object references; this change does not claim deep immutability against callers mutating those objects themselves.

## Three variations to work through

Each is a concrete edit to [test/store.test.js](../test/store.test.js). Predict the result, then
run `node --test test/store.test.js`.

**Variation 1 (normal) - reverse the tag order.**
Change the tags string from `" Utility,utility, EVENTS, ,events "` to
`" utility,Utility, events, ,EVENTS "`. Predicted result: `["utility", "events"]` - lower case
now, because `parseTags` keeps the **first** spelling it sees for each key (`store.js:36-44`), and
you just changed which one is first. The count is unchanged; only the casing moved. This is worth
doing because it makes the rule visible: the function is not "prefer capitals" or "prefer the
longest"; it is "first wins", which is a decision someone made and which you would have to
re-make if tags were ever merged from two sources.

**Variation 2 (invalid) - edit a snippet that was deleted underneath you.**
Save a snippet, capture its id, call `store.deleteSnippet(id)`, then call `store.saveSnippet`
with that same id. Predicted result: a throw with the message `"This snippet no longer exists."`,
**zero** writes after the delete (compare `data.get("js1-snippet-vault")` before and after), and
`isUserFacingError(error)` returning `true` - which is what lets `main.js:52-61` show the user
that exact sentence instead of a generic one. Contrast with a blank title, which throws
`"Add a title and some code."`, and with a quota failure, which throws `"quota"` and is **not**
user-facing. Three failures, three different things the user should be told. Error text alone
does not prove data integrity, so assert the bytes as well.

**Variation 3 (boundary) - fail the write, then let the retry succeed.**
Replace the blanket `globalThis.localStorage.setItem = () => { throw ... }` with a counter that
throws once and then delegates to the real `Map`-backed setter. Save (fails), then save again
with identical input (succeeds). Predicted result after the first: `getSnippet` still returns the
old title, `data.get("js1-snippet-vault")` is byte-identical, and the list length is unchanged.
After the second: exactly **one** new snippet, not two - because the failed attempt never reached
`snippets = next` at `store.js:33`, so there is no half-applied state to duplicate. Now reverse
the two lines in `commit` and re-run: the first attempt leaves the module array already updated,
so the retry either duplicates or silently "succeeds" with a list that was never on disk. That is
the regression this change exists to prevent, and it is invisible to any test that only checks
whether an error was thrown.

## Executable examples

These are the actual regression tests in [test/store.test.js](../test/store.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
async function fixture() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  return { store: await import(`../src/store.js?case=${randomUUID()}`), data };
}
test("tags normalize once; failed writes do not publish a new snippet or consume an existing one", async () => {
  const { store, data } = await fixture();
  store.saveSnippet({
    title: "Test",
    language: "JS",
    tags: " Utility,utility, EVENTS, ,events ",
    code: "const x = 1;",
  });
  const first = store.listSnippets()[0];
  assert.deepEqual(first.tags, ["Utility", "EVENTS"]);
  const before = data.get("js1-snippet-vault");
  globalThis.localStorage.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(
    () =>
      store.saveSnippet({
        id: first.id,
        title: "Changed",
        language: "JS",
        tags: "x",
        code: "x",
      }),
    /quota/,
  );
  assert.equal(store.getSnippet(first.id).title, "Test");
  assert.throws(() => store.deleteSnippet(first.id), /quota/);
  assert.equal(data.get("js1-snippet-vault"), before);
});
test("missing ids and blank content fail without saving; clipboard rejection returns false", async () => {
  const { store, data } = await fixture();
  assert.throws(
    () =>
      store.saveSnippet({
        id: "missing",
        title: "T",
        code: "x",
        language: "JS",
        tags: "",
      }),
    /no longer/,
  );
  assert.throws(
    () =>
      store.saveSnippet({ title: " ", code: "x", language: "JS", tags: "" }),
    /title/,
  );
  assert.equal(data.size, 0);
  const { copyToClipboard } = await import("../src/dom.js");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    },
  });
  assert.equal(await copyToClipboard("x"), false);
  let copied = "";
  globalThis.navigator.clipboard.writeText = async (text) => {
    copied = text;
  };
  assert.equal(await copyToClipboard("const x = 1;"), true);
  assert.equal(copied, "const x = 1;");
});
test("the store's two deliberate errors are distinguishable from an unexpected one", async () => {
  const { store } = await fixture();
  store.saveSnippet({ title: "Kept", language: "JS", tags: "", code: "const x = 1;" });
  const saved = store.listSnippets()[0];
  // load() seeds two starter snippets when storage is empty, so this is 3.
  const countBefore = store.listSnippets().length;

  // Editing a snippet that has been deleted in another tab is a different
  // situation from leaving the title blank, and store.js already says so. The
  // UI used to catch both with a bare `catch {}` and print one fixed sentence,
  // which is exactly what 02-CONCEPTS argues feedback must not do.
  const missing = (() => {
    try {
      store.saveSnippet({ id: "gone", title: "T", language: "JS", tags: "", code: "x" });
    } catch (error) {
      return error;
    }
  })();
  assert.equal(missing.message, "This snippet no longer exists.");
  assert.equal(store.isUserFacingError(missing), true);

  const blank = (() => {
    try {
      store.saveSnippet({ title: "  ", language: "JS", tags: "", code: "x" });
    } catch (error) {
      return error;
    }
  })();
  assert.equal(blank.message, "Add a title and some code.");
  assert.equal(store.isUserFacingError(blank), true);
  assert.notEqual(blank.message, missing.message);

  // A storage failure is NOT user-facing: "quota" is not a sentence to show a
  // person, so main.js substitutes its own wording for this one only.
  globalThis.localStorage.setItem = () => {
    throw new Error("quota");
  };
  const quota = (() => {
    try {
      store.saveSnippet({ title: "New", language: "JS", tags: "", code: "x" });
    } catch (error) {
      return error;
    }
  })();
  assert.equal(quota.message, "quota");
  assert.equal(store.isUserFacingError(quota), false);

  // None of the three rejections published anything.
  assert.equal(store.listSnippets().length, countBefore);
  assert.equal(store.getSnippet(saved.id).title, "Kept");
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
