# Trace lab: Filtering and sorting are separate operations

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
const books = [
  {id:'z',title:'Zebra',rating:5,status:'Finished'},
  {id:'a',title:'Alpha',rating:5,status:'Finished'},
  {id:'b',title:'Beta',rating:5,status:'Reading'},
];
const visible = [...books].filter(book => book.status === 'Finished')
  .sort((a,b) => b.rating-a.rating || a.title.localeCompare(b.title));
console.log(visible.map(book => book.id)); // ['a','z']
console.log(books.map(book => book.id));   // ['z','a','b']
```

## Follow the boundary with concrete values

There is no HTTP layer here, so the six boundaries a server request crosses appear as six
in-process ones. Five of them are read-only - this whole lesson is about a **projection**, a
derived view that must not disturb the record it is derived from. Walk them in order with the
`records` fixture from [test/filters.test.cjs](../test/filters.test.cjs).

**Boundary 1 - the three input surfaces (`index.html:61-68`, listeners at `app.js:43-59`).**
Unusually, three different controls feed the same projection and each owns exactly one module
variable: `#search` writes `searchTerm` (`app.js:50-53`, lower-cased on the way in),
`#sort` writes `sortMode` (`app.js:54-57`), `#status-filter` writes `statusFilter`
(`app.js:43-46`). All three then call `renderBooks()`. Write down what each one does **not**
do: none of them touches `books`, and none of them writes to `localStorage`. Say why that is the
single most important property of this design.

**Boundary 2 - the copy (`app.js:133`).**
`[...books]` is the boundary between the record and the projection, and it is one character wide.
`Array.prototype.sort` mutates in place; without the spread, sorting the view would permanently
reorder the saved array, and the next `persistBooks()` would write that reordering to disk.
Delete the three dots and run the delivered test to see it fail on the
`localStorage...[0].id === "z"` assertion - that assertion exists for exactly this reason.

**Boundary 3 - the predicate (`app.js:134-137`).**
One `filter` with two composed conditions: `(statusFilter === "All" || book.status === statusFilter)`
and `searchable.includes(searchTerm)`. Write the full truth table for a single book - matching
status/matching text, matching status/non-matching text, non-matching status/matching text,
neither - and confirm only the first row survives. Then note the alternative that was *not*
chosen: two chained `.filter()` calls would produce the same rows, but composing them in one
predicate keeps the "which books are visible" rule in one readable place, and makes it obvious
that the search string is matched against a concatenation that **includes the status**
(`app.js:135`) - so typing "finished" in the search box is a second, sloppier status filter.

**Boundary 4 - the comparator (`app.js:138-147`).**
The decisive logic. `Array.prototype.sort` is required by the spec to be stable since ES2019,
but stability only preserves the order of elements the comparator calls **equal** - it does not
invent one. A comparator that compares one field leaves every tie in input order, so the view
silently depends on insertion order, which changes every time someone adds a book. The fix is a
*total* comparator: `rating`, then `title`, then `id`, with `||` short-circuiting to the next
key only on a `0`. Write out what each of the three chained expressions returns for Zebra vs
Alpha (`0`, then a negative number, so `id` is never consulted).

**Boundary 5 - coercion (`app.js:142`, `app.js:146`).**
`String(a.id).localeCompare(String(b.id))`. The tie-break is the last line of defence and must
never be the thing that throws. Records written by an older build carry numeric ids, and
`Number.prototype.localeCompare` does not exist. Write down what the uncoerced version does with
`{id: 1}`: a `TypeError` inside `sort`, escaping `renderBooks`, an empty `#books` element and a
page that looks broken while the data is perfectly fine. The "legacy records" test pins this.

**Boundary 6 - the two denominators (`renderBooks`, `app.js:146-149`).**
`#reading-summary` deliberately reports two different counts from two different sources:
`visibleBooks.length` (the projection) and `books.filter(b => b.status === "Finished").length`
(the record). "Showing 0 of 3 books. 2 finished overall." is a correct and useful sentence; a
naive implementation computes both from `visibleBooks` and tells the user their finished count
dropped to zero because they typed in a search box. Write both numbers for the fixture after
searching `unmatched`.

### One more trace to run

Change one visible book to Reading in the real editor. It should leave the Finished view and
remain retrievable in All, with the same id - `saveBook` at `app.js:87-88` maps over `books`
replacing the matching record, and `book.id` came from `idInput.value` (`app.js:74`), not from a
fresh `randomUUID()`. That is a state change followed by a new projection, not a deletion.

## Connect the model to real code

Open [app.js](../app.js) beside [test/filters.test.cjs](../test/filters.test.cjs). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

Zebra and Alpha both have rating five and Finished status; Beta is Reading. Filter Finished, search Maya and sort by rating: Alpha then Zebra appear. Saved order remains Zebra, Alpha, Beta. An unmatched query shows zero results while overall finished stays two.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
