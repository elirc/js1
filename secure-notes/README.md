# Secure Notes

A React + Node CRUD project that adds **authentication**. Notes are private:
you only see your own, and every notes route requires a valid token.

## Learning goals

- Register and log in, hashing passwords with `scrypt` + a per-user salt
- Compare hashes with `timingSafeEqual` (constant-time, avoids timing leaks)
- Issue a bearer token on login and send it as `Authorization: Bearer <token>`
- Protect routes with a `requireAuth` middleware that attaches `req.user`
- Scope every query to `req.user.id` so users can't read each other's data
- Persist the token in `localStorage` and restore the session on reload

## Routes

```
POST   /api/auth/register     create account -> { token, user }
POST   /api/auth/login        sign in        -> { token, user }
POST   /api/auth/logout       invalidate the current token
GET    /api/auth/me           who am I (requires token)
GET    /api/notes             list MY notes (requires token)
POST   /api/notes             create a note for me
PUT    /api/notes/:id         update one of my notes
DELETE /api/notes/:id         delete one of my notes
```

## Security notes (read these)

This is a teaching scaffold, not production auth:

- Users, sessions, and notes live in memory and reset on restart.
- Real apps use signed/expiring tokens (JWT or server sessions), HTTPS, rate
  limiting, and an established hashing library (bcrypt/argon2).
- Returning the same "Invalid email or password" message for both bad-email and
  bad-password keeps the API from leaking which emails exist.

## Stretch ideas

- Add token expiry and refresh
- Persist users and notes (combine with the `note-vault` file approach)
- Add an HTTP-only cookie option instead of `localStorage`
