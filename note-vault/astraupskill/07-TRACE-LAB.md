# Trace lab: Queue the whole operation

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
// Reduced ordering example, not a substitute for the file repository.
let tail = Promise.resolve();
function enqueue(operation) {
  const result = tail.then(operation);
  tail = result.catch(() => {}); // later work can still run
  return result;                // this caller still sees rejection
}
```

## Follow the boundary with concrete values

This is the one project in the batch with a real client, a real HTTP layer and a real
persistence layer, so all six boundaries are separate files. Trace `POST /api/notes` with the
body `{ "title": "Saved note", "body": "hello" }` and write the value at every hand-off.

**Boundary 1 - the client component (`client/src/App.jsx`, mounted by `client/src/main.jsx`).**
Start here, because before the change this boundary did not execute at all. `client/index.html`
pointed its `<script type="module">` at `App.jsx`, a file whose only export is a component -
nothing ever called `createRoot`, so the page rendered an empty `<div id="root">` with no error
in the console. `main.jsx` is the two lines that connect a component to a DOM node. Write down
what the form hands over: a plain object with `title` and `body`, and nothing else - no id, no
`updatedAt`, no `pinned`. Those are the server's to decide.

**Boundary 2 - the client serializer (`client/src/api.js`).**
`fetch` with `method: "POST"`, `headers: { "Content-Type": "application/json" }` and
`JSON.stringify(body)`. Three things change representation here: the object becomes a byte
string, the types collapse (JSON has no `undefined`, no `Date`, no `Infinity`), and the
`Content-Type` header is the *only* reason the server will parse it - drop that header and
`express.json()` leaves `req.body` as `{}`, which the validator then rejects with a 400 that
says "Title must be at least 2 characters". Predict that error message for a request with no
`Content-Type`; it is a good example of an error that describes the symptom, not the cause.

**Boundary 3 - the HTTP route (`server/server.js:26-28`).**
`app.post("/api/notes", validateNote, wrap(async (req, res) => ...))`. Note three separate
decisions on one line. `express.json({ limit: "128kb" })` (`server.js:16`) has already run and
may have rejected the request before any of your code sees it. `validateNote` runs as middleware
*before* the handler, so a rejected body never reaches the repository. And `wrap`
(`server.js:18`) is what makes an `async` handler safe: without it, a rejected promise inside an
Express 4 handler is an unhandled rejection and the client hangs until it times out. Write down
which of the five routes use `wrap` (all of them) and what the error handler at `server.js:54-64`
turns an exception into (any 4xx the error already carries is passed through; anything else
becomes a 500 with a fixed message).

**Boundary 4 - the validator (`validateNote`, `server/server.js:65-73`).**
Four checks, each rejecting for a reason worth stating: `typeof title !== "string"` (a JSON
number or object would otherwise reach `.trim()` and throw), `title.trim().length < 2`
(normalised length, so `"  a  "` is rejected), `title.length > 255` (raw length, so trimming
cannot be used to smuggle a long title past the bound), and a separate 100 000-character bound on
the body. Predict the status and message for `{ title: 123, body: "x" }` - the delivered test
asserts exactly this.

**Boundary 5 - the repository and its critical section
(`server/repository.js:6-13`, methods at `:57-104`, the wrapper at `:105`).**
This is the decisive boundary of the lesson. Every exported method is wrapped in `serial(...)` by
the `Object.fromEntries(...)` line at the end of the factory, so the **whole** read-modify-write
- `readAll()`, the `push`/`findIndex`/`filter`, and `writeAll()` - happens inside one link of the
promise chain. Draw the unsafe interleaving first: A reads `[welcome]`, B reads `[welcome]`,
A writes `[welcome, a]`, B writes `[welcome, b]`, and A's note is gone. Merely ordering the final
*writes* keeps that same wrong answer - the reads are what have to be serialised. Then trace the
queue: `tail = result.catch(() => {})` (`repository.js:10`) is the line that stops a rejected
operation from poisoning every later one, which is why the delivered test can fail a `rename`
and then succeed on retry.

**Boundary 6 - the durable write and the response (`writeAll`, `repository.js:37-46`).**
Inside the critical section there is a second, smaller atomicity boundary: write to
`${file}.${randomUUID()}.tmp` with `{ flag: "wx" }` (fail if it already exists), then `rename`
onto the target. `rename` within one filesystem is atomic, so a reader sees either the old file
or the new one - never a half-written file, which is exactly what a plain `writeFile` over the
target risks. The `finally` unlinks the temp file whether or not the rename succeeded. Only then
does the handler at `server.js:27` send `201` with the created note. Write down what the client
learns that it did not send: `id`, `pinned` and `updatedAt`.

### What the guarantee does not cover

Reopening the repository after completion proves persistence, and the delivered test does that -
but the queue is **per repository instance, per process**. Two Node processes, or two
`createNoteRepository` calls on the same file, are outside the guarantee entirely. Say out loud
what would be needed instead (an advisory lock, or a database), and note that
`astrdocs/ALL_20_PROJECTS_REPORT.md` states this limit rather than hiding it.

## Connect the model to real code

Open [server/repository.js](../server/repository.js) beside [test/persistence.test.js](../test/persistence.test.js). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

With one welcome note, twelve concurrent creates leave thirteen records. Pin four created ids: those four are pinned independently of the welcome note. Reject a rename, compare original bytes, retry successfully and reopen the repository to read the result.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
