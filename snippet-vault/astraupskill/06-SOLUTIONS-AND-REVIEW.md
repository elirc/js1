# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same check chapter 03 runs; run it after your change and compare the result to the expected observations in chapter 03:

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

## Existing implementation

Create, edit and delete publish only after persistence succeeds. Tags deduplicate case-insensitively, missing edit ids and blank content are rejected, and clipboard denial returns false so the UI can explain failure.

The key model is: The store owns snippets, main.js owns forms and views, and dom.js owns rendering/clipboard work. Tags retain their first display spelling while deduplicating lowercase comparison keys.

The worked fixture should behave as follows: Tags Utility,utility, EVENTS,events become Utility and EVENTS. A failed title-edit write leaves saved and in-memory titles unchanged. Clipboard rejection resolves false instead of producing an unhandled rejection.

## Extension solutions

### Exercise 1

**Prompt:** Return defensive read copies.

**Approach:** Copy records and tag arrays and test attempted mutation through a returned value.

**Review:** You are done when a caller cannot change stored data by mutating what a read returned, and you can demonstrate the hole you closed. Demonstrate it first: `const s = getSnippet(id); s.title = "hacked";` then `getSnippet(id).title` - the module's array holds the same object reference, so the "read" was a write. The naive fix is `{ ...snippet }`, which is a **shallow** copy: `tags` is still the same array, so `getSnippet(id).tags.push("x")` still mutates stored data. Use `structuredClone`, or copy `tags` explicitly, and test the nested case, because that is the one a shallow copy passes. Then state the cost honestly: cloning on every read of a list is real work, and the alternative - `Object.freeze` on commit - fails silently in sloppy mode instead. The invariant to keep: `commit` (`store.js:31-34`) remains the only path that changes `snippets`.

### Exercise 2

**Prompt:** Add a normalized tag filter.

**Approach:** Compare normalized tags while keeping display spelling; compose with existing filters.

**Review:** You are done when filtering by tag uses the *same* normalization rule as saving, from the same function. The naive implementation writes `snippet.tags.includes(selectedTag)` in `listSnippets` and immediately disagrees with `parseTags` (`store.js:36-44`): a snippet saved with `"Utility"` will not match a filter for `"utility"`, which is precisely the case-insensitivity the save path went to trouble to provide. Export the key function (`tag => tag.trim().toLowerCase()`) and use it on both sides. Show the ordinary case and the breaking one: a snippet tagged `"EVENTS"` must be found by a filter for `"events"`, and the tag shown in the UI must still read `EVENTS`. Also decide what an unknown tag does - empty list, or all snippets? - and make the empty state say which.

### Exercise 3

**Prompt:** Test clipboard absence and denial separately.

**Approach:** Provide one fixture without the API and one whose promise rejects; neither should claim a successful copy.

**Review:** You are done when your test distinguishes three outcomes that all currently produce `false`: the API is absent, the promise rejects, and the write succeeds. The naive implementation deletes `navigator.clipboard` and asserts `false`, which passes identically whether `copyToClipboard` (`dom.js:58-65`) checks for the method or catches a rejection - so it proves nothing about either branch. Write them separately: (a) `navigator` with no `clipboard`, (b) `clipboard.writeText` that rejects, (c) one that resolves, asserting `true` and that it received the exact code string. Then argue the design: absence is a permanent property of the environment and denial is a per-call decision, yet the helper collapses them. Should the UI say "Copying is not available in this browser" and "You denied clipboard access" differently? Whatever you answer, the test should make the two distinguishable at the boundary even if the UI chooses not to.

### Exercise 4

**Prompt:** Add a validated versioned import/export.

**Approach:** Validate the entire envelope and all records before one commit, keeping ids and old state on failure.

**Review:** This is the stretch design; the deliverable is a schema plus a validation plan. You are done when the note says what happens to an import file that is *almost* right. The naive plan is `snippets = JSON.parse(file)` - which accepts an array of anything, so a snippet with no `id`, a `tags` string instead of an array, or a `code` field of 40 MB all land in storage and break rendering later, far from the cause. Specify: a versioned envelope (`{ version: 1, snippets: [...] }`), a per-record validator that runs before anything is committed, and an all-or-nothing rule - partial imports leave the user unable to say what they now have. Decide the id collision policy explicitly (reject, or re-mint ids and lose cross-references) and the size bound. Then reuse what exists: `parseTags` must run on imported tags too, or imported snippets will carry duplicates that the UI can never have created. Test plan: a valid file, a wrong-version file, a file with one bad record (assert **nothing** was written), and the same valid file imported twice.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/store.test.js](../test/store.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: The store mutated before writing, duplicate tag variants accumulated, and rejected clipboard promises could escape without feedback. I changed the implementation so that: Create, edit and delete publish only after persistence succeeds. Tags deduplicate case-insensitively, missing edit ids and blank content are rejected, and clipboard denial returns false so the UI can explain failure. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
