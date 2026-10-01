# Trace lab: A module owns a commit boundary

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
const seen = new Set();
const tags = ' Utility,utility, Events '.split(',').map(x => x.trim())
  .filter(tag => {
    const key = tag.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
console.log(tags); // ['Utility','Events']
```

## Follow the boundary with concrete values

This project has no HTTP layer, but it does have something the other browser projects in this
batch do not: three real modules with a rule about who may talk to whom. `store.js` owns the data
and never touches the DOM; `dom.js` builds elements and never touches storage; `main.js` is the
only file allowed to know about both. The six boundaries a server request crosses map onto that
split almost exactly. Trace saving a snippet with tags `" Utility,utility, EVENTS, ,events "`.

**Boundary 1 - the form (`main.js:37-42`, elements declared at `main.js:9-22`).**
`handleSubmit` reads five raw `input.value` strings and does one cheap check of its own -
`!titleInput.value.trim() || !codeInput.value.trim()` - before calling the store. Ask why that
check exists at all when `store.js:80` checks the same thing: this one is a UX shortcut, the
store's is the rule. Write down which one you would delete if you had to keep exactly one, and
why it is not this one.

**Boundary 2 - the module boundary (`main.js:44-51` calling `saveSnippet`).**
Everything crosses as one plain object of strings - including `tags`, which is still the raw
comma-separated text. `main.js` deliberately does **not** split it. That is the serializer
boundary: the caller hands over the user's input in the user's form, and the owner of the data
decides what it means.

**Boundary 3 - validation (`store.js:80-81`).**
Two `throw`s, and they are different failures: `"Add a title and some code."` is *your input is
incomplete*, `"This snippet no longer exists."` is *the thing you are editing is gone* - which in
a real app means another tab, or another user, deleted it while your form was open. Both messages
are written for a person on purpose; `isUserFacingError` (`store.js:55-57`) is what lets the UI
tell them apart from a storage failure, whose message ("quota") is not for anybody's eyes.

**Boundary 4 - normalization (`parseTags`, `store.js:36-44`).**
The decisive representation change. A `Set` holds **comparison keys** (`tag.toLowerCase()`) while
the returned array holds **display strings** (the original casing, first occurrence wins). Walk
the fixture: `" Utility"` → key `utility`, kept as `"Utility"`; `"utility"` → key already seen,
dropped; `" EVENTS"` → kept as `"EVENTS"`; `" "` → empty key, dropped; `"events"` → dropped.
Result `["Utility", "EVENTS"]`. The mistake to avoid is storing the keys: comparing
case-insensitively is not a reason to *save* everything lowercased, and once you have, the user's
casing is gone for good.

**Boundary 5 - persist, then publish (`commit`, `store.js:31-34`).**
`localStorage.setItem(...)` first; `snippets = next` second. Two statements, and the order is the
whole guarantee. If `setItem` throws, the assignment never runs, the module-level array is
untouched, and the error propagates to `main.js` - so `getSnippet(id)` still returns the old
title *and* the serialized bytes are unchanged. The delivered test asserts both, which is more
than "an error was thrown".

**Boundary 6 - feedback and render (`main.js:44-65`, `dom.js:58-65`).**
`main.js` catches, chooses a message, and returns **before** `resetForm()` and `render()` - so a
failed save leaves the user's typing in the form. Then the clipboard, which is the same lesson in
a different shape: `copyToClipboard` (`dom.js:58-65`) returns `false` on denial instead of
rejecting. Note that `navigator.clipboard?.writeText` *existing* proves nothing - permission is
decided when the promise settles, not when you look up the method. Returning `false` and throwing
are different contracts: `false` says "this is an expected outcome, handle it"; a rejection says
"something went wrong that you probably cannot handle here". Say which you would choose for a
paste-blocked browser and why.

## Connect the model to real code

Open [src/store.js](../src/store.js) beside [test/store.test.js](../test/store.test.js). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

Tags Utility,utility, EVENTS,events become Utility and EVENTS. A failed title-edit write leaves saved and in-memory titles unchanged. Clipboard rejection resolves false instead of producing an unhandled rejection.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
