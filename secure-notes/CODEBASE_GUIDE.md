# Secure Notes Codebase Guide

Secure Notes introduces authentication. Treat it as a learning scaffold, not production security, but study the boundaries carefully.

## Code Map

- `server/server.js`: auth routes, token middleware, note CRUD.
- `client/src/api.js`: API calls with bearer tokens.
- `client/src/App.jsx`: login/register state and private notes UI.

## Password Hashing

```js
const salt = randomBytes(16).toString("hex");
const passwordHash = hashPassword(password, salt);
```

Never store plain-text passwords. This project uses `scrypt` and a per-user salt, which is the right conceptual pattern.

## Constant-Time Comparison

```js
timingSafeEqual(Buffer.from(candidateHash), Buffer.from(user.passwordHash))
```

Timing-safe comparison avoids leaking information through tiny timing differences. This is a deeper security habit worth noticing.

## Auth Middleware

```js
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const userId = tokens.get(token);
  req.user = { id: userId };
  next();
}
```

Middleware is how Express shares cross-cutting behavior. Authentication, logging, rate limiting, and request IDs are often middleware.

## Ownership Check

```js
const note = findOwnedNote(req.params.id, req.user.id);
```

This is crucial: authentication says who you are; authorization says what you can access. Scope every note query by the authenticated user.

## Extension Practice

- Add token expiration.
- Add password validation rules.
- Add refresh tokens conceptually.
- Store users and notes in a database.
- Add tests for "user A cannot read user B note."

Security bugs are often missing authorization checks, not missing login screens.
