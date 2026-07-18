# Secure Notes - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4108**).
> In-memory `users` (scrypt+salt hashes), `tokens` (token->userId), and `notes`
> scoped per user. `requireAuth` reads `Authorization: Bearer <token>` and sets
> `req.user`. The React client stores the token in `localStorage` (`client/src/
> api.js`) and shows an `AuthScreen` or `NotesScreen` (`client/src/App.jsx`).

---

## Story 1: Change password
**As a** user, **I want** to change my password, **so that** I can keep my account secure.

### Acceptance criteria
- [ ] `POST /api/auth/change-password` (protected) verifies the current password and sets a new one (6 chars).
- [ ] A wrong current password returns 401; a too-short new password returns 400.
- [ ] Existing tokens optionally stay valid (document the choice).

### Implementation plan
1. **`server/server.js`** - add a protected route using `requireAuth`. Verify `verifyPassword(currentPassword, req.user)`; on success generate a new `salt` and `passwordHash` via the existing `randomBytes`/`hashPassword` helpers and update the user.
2. **`server/server.js`** - reuse the password-length validation from `register`.
3. **`client/src/api.js`** - add `changePassword(body)` (sends the bearer token automatically).
4. **`client/src/App.jsx`** - add a small "Change password" form in `NotesScreen`.

### How to test
Change the password, log out, log in with the new password (old one fails); submit a 3-char password -> 400.

---

## Story 2: Tag notes (per user)
**As a** user, **I want** tags, **so that** I can organize my private notes.

### Acceptance criteria
- [ ] Notes store a `tags` array; create/edit accept comma-separated tags.
- [ ] `GET /api/notes?tag=` filters to the current user's notes with that tag.

### Implementation plan
1. **`server/server.js`** - store `tags` on create/update (trim/lowercase/filter). In `GET /api/notes`, read `tag` and filter `notesFor(req.user.id)` further by `note.tags.includes(tag)`.
2. **`client/src/api.js`** - `listNotes` already exists; add the optional `tag` query.
3. **`client/src/App.jsx`** - tags input + chips + a tag filter, all inside `NotesScreen`.

### How to test
As one user, tag and filter notes; log in as a second user and confirm you never see the first user's notes or tags.

---

## Story 3: Read-only share links
**As a** user, **I want** to share a note read-only, **so that** others can view without an account.

### Acceptance criteria
- [ ] `POST /api/notes/:id/share` (protected) returns a random `shareId`.
- [ ] `GET /api/shared/:shareId` (public) returns the note's title/body only.
- [ ] Revoking removes the share.

### Implementation plan
1. **`server/server.js`** - add a `shares` Map (`shareId -> noteId`). The share route checks the note belongs to `req.user.id`, creates `randomUUID()`, stores it, returns `{ shareId }`. Add a public `GET /api/shared/:shareId` (no `requireAuth`) returning only `{ title, body }`. Add a `DELETE /api/notes/:id/share` to revoke.
2. **`client/src/api.js`** + **`App.jsx`** - add a "Share" button that shows the public URL (`/shared/:id`); a tiny public viewer page or a fetch demo is enough.

### How to test
Share a note, open `GET /api/shared/<id>` without a token, confirm only title/body return; revoke and confirm it 404s.

---

## Story 4: Token expiry and refresh
**As a** security-conscious user, **I want** sessions to expire, **so that** stolen tokens don't last forever.

### Acceptance criteria
- [ ] Tokens carry an expiry; `requireAuth` rejects expired tokens (401).
- [ ] `POST /api/auth/refresh` issues a fresh token for a still-valid session.
- [ ] The client refreshes transparently or prompts re-login on expiry.

### Implementation plan
1. **`server/server.js`** - change `tokens` to store `{ userId, expiresAt }`. In `issueSession`, set `expiresAt = Date.now() + 60*60*1000`. In `requireAuth`, also reject (and delete) when `Date.now() > expiresAt`.
2. **`server/server.js`** - add `POST /api/auth/refresh` (protected) that deletes the old token and issues a new one.
3. **`client/src/api.js`** - on a 401 from a notes call, call refresh once and retry; if that fails, clear the token (it already clears on 401) so the UI returns to the login screen.

### How to test
Shorten the expiry to ~10s for testing, wait it out, confirm the next call 401s and the UI returns to login; refresh before expiry keeps the session.

---

## Story 5: Log out everywhere
**As a** user, **I want** to invalidate all my sessions, **so that** I can secure a compromised account.

### Acceptance criteria
- [ ] `POST /api/auth/logout-all` (protected) deletes every token for the user.
- [ ] Other devices' tokens stop working immediately (401).

### Implementation plan
1. **`server/server.js`** - add the route: iterate `tokens` and delete every entry whose `userId === req.user.id` (works whether tokens store a raw id or `{ userId, expiresAt }`).
2. **`client/src/api.js`** + **`App.jsx`** - add a "Log out everywhere" button in `NotesScreen` that calls it then clears the local token and returns to `AuthScreen`.

### How to test
Log in from two browser tabs, click "Log out everywhere" in one, confirm the other tab's next request 401s and bounces to login.

