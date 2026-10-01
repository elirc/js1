# Concepts explained from first principles

[Course index](README.md)

## The central idea: authorizing records and rejecting malformed JSON

Authentication asks which user the request represents. Authorization asks whether that user may access this note. Finding a note by ID alone is insufficient: the owner predicate must also match. Returning the same 404 for a missing and another user's note keeps the response consistent. The test signs in as two different users and tries each operation rather than merely inspecting the middleware name.

TypeScript is not involved in this JavaScript server, and even TypeScript types would not validate network JSON. A password object must fail before scryptSync. Email normalization trims and lowercases before looking up the same map key for register and login. Passwords are not trimmed, because spaces are part of the user's chosen credential.

The title has a 2–200 character rule; the body is text up to 20,000 characters. Validation happens before the note mutates. This is a small authentication teaching app, with in-memory sessions, open CORS and synchronous hashing. Persistent accounts, rate limits, session expiration and deployment configuration remain separate improvements.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Credentials and note text are typed and bounded, email normalization is consistent, and an owned note detail endpoint completes the read path. Owner checks protect read, update and delete; logout revokes its token.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Users and tokens are Maps; notes are an array with id, userId, title, body and createdAt. A Bearer token selects a user. Passwords are salted and hashed with scrypt. All data and sessions disappear on server restart.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Where session expiry belongs

A note handler asks one question: does this note belong to `req.user`? It should never have to ask whether the caller's session is still fresh. That is why expiry lives in `requireAuth` and the `tokens` store (`server/server.js`): the store records `expiresAt` when `issueSession` runs, and `requireAuth` deletes a stale token and answers 401 before any note code executes. Two consequences to predict before you read the new test: logout on an expired token is also 401 (there is nothing left to revoke), and a fresh login after expiry works because `users` and `notes` were never touched. If expiry were checked inside `findOwnedNote`, every route would need the check and a future route could forget it.

