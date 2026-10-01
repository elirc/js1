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
