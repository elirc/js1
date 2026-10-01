const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");

const records = [
  {
    id: "z",
    title: "Zebra",
    author: "Maya",
    status: "Finished",
    rating: "5",
    notes: "JavaScript",
  },
  {
    id: "a",
    title: "Alpha",
    author: "Maya",
    status: "Finished",
    rating: "5",
    notes: "JavaScript",
  },
  {
    id: "b",
    title: "Beta",
    author: "Lin",
    status: "Reading",
    rating: "5",
    notes: "JavaScript",
  },
];
test("status, search and rating ordering compose without changing persisted order", async () => {
  const app = await openApp({ "js1-reading-list": JSON.stringify(records) });
  try {
    app.document.querySelector("#status-filter").value = "Finished";
    app.event("#status-filter", "change");
    app.document.querySelector("#search").value = "maya";
    app.event("#search", "input");
    app.document.querySelector("#sort").value = "rating";
    app.event("#sort", "change");
    assert.deepEqual(
      [...app.document.querySelectorAll(".book-card h2")].map(
        (x) => x.textContent,
      ),
      ["Alpha", "Zebra"],
    );
    assert.equal(
      JSON.parse(app.w.localStorage.getItem("js1-reading-list"))[0].id,
      "z",
    );
    assert.match(
      app.document.querySelector("#reading-summary").textContent,
      /Showing 2 of 3.*2 finished/,
    );
    app.document.querySelector("#search").value = "unmatched";
    app.event("#search", "input");
    assert.equal(app.document.querySelector("#empty").hidden, false);
  } finally {
    app.close();
  }
});
test("title and status sorts fall back to the id tie-break", async () => {
  const tied = [
    { id: "c", title: "Same Title", author: "Lin", status: "Reading", rating: "3", notes: "" },
    { id: "a", title: "Same Title", author: "Maya", status: "Reading", rating: "1", notes: "" },
    { id: "b", title: "Same Title", author: "Ada", status: "Reading", rating: "5", notes: "" },
  ];
  const app = await openApp({ "js1-reading-list": JSON.stringify(tied) });
  try {
    // Sorting by title: every title is identical, so the only thing that can
    // order these three rows is the id tie-break on app.js:145.
    app.document.querySelector("#sort").value = "title";
    app.event("#sort", "change");
    assert.deepEqual(
      [...app.document.querySelectorAll(".book-card .author")].map((x) => x.textContent),
      ["By Maya", "By Ada", "By Lin"],
      "ids a, b, c - not the insertion order c, a, b",
    );

    // Sorting by status: same reasoning, and it exercises the other branch of
    // the comparator (the non-rating branch reads a[sortMode]).
    app.document.querySelector("#sort").value = "status";
    app.event("#sort", "change");
    assert.deepEqual(
      [...app.document.querySelectorAll(".book-card .author")].map((x) => x.textContent),
      ["By Maya", "By Ada", "By Lin"],
    );

    // The saved order is a different fact from the displayed order.
    assert.deepEqual(
      JSON.parse(app.w.localStorage.getItem("js1-reading-list")).map((b) => b.id),
      ["c", "a", "b"],
    );
  } finally {
    app.close();
  }
});

test("legacy records with numeric ids sort instead of throwing", async () => {
  // Records written by an older build stored ids as numbers. String.prototype
  // .localeCompare does not exist on a Number, so an uncoerced tie-break threw
  // "a.id.localeCompare is not a function" and rendered nothing at all.
  const legacy = [
    { id: 20, title: "Same Title", author: "Lin", status: "Reading", rating: "3", notes: "" },
    { id: 3, title: "Same Title", author: "Maya", status: "Reading", rating: "3", notes: "" },
  ];
  const app = await openApp({ "js1-reading-list": JSON.stringify(legacy) });
  try {
    app.document.querySelector("#sort").value = "title";
    app.event("#sort", "change");
    const authors = [...app.document.querySelectorAll(".book-card .author")].map(
      (x) => x.textContent,
    );
    assert.equal(authors.length, 2, "both rows render; the comparator did not throw");
    // String ordering, deliberately: "20" sorts before "3". That is a real
    // consequence of coercion and it is why ids should be strings at creation
    // time - see crypto.randomUUID() in saveBook (app.js:74).
    assert.deepEqual(authors, ["By Lin", "By Maya"]);
  } finally {
    app.close();
  }
});
