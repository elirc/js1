# Mini Blog - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4107**). A
> `createBlogRepository()` holds `posts` and `comments` (one-to-many via
> `comment.postId`); posts expose a derived `commentCount`; deleting a post
> cascades its comments. Routes include nested `/api/posts/:id/comments`. React
> client in `client/src/App.jsx` via `client/src/api.js`.

---

## Story 1: Edit a comment
**As a** reader, **I want** to fix my comment, **so that** I can correct typos.

### Acceptance criteria
- [ ] `PUT /api/posts/:postId/comments/:commentId` updates the text (validated).
- [ ] The client shows an inline edit for a comment.
- [ ] Editing a missing comment returns 404.

### Implementation plan
1. **`server/server.js`** - add a repo method `updateComment(postId, commentId, input)` that finds the matching comment and updates `text`/`author`; add a `PUT` route using the existing `validateComment` middleware.
2. **`client/src/api.js`** - add `editComment(postId, commentId, comment)`.
3. **`client/src/App.jsx`** - add an "Edit" toggle on each comment that swaps the text for inputs and calls `editComment`, then `loadComments`.

### How to test
Edit a comment, confirm the text changes and persists on reload; PUT a bad id -> 404.

---

## Story 2: Like counts on posts
**As a** reader, **I want** to like posts, **so that** popularity is visible.

### Acceptance criteria
- [ ] Posts have a `likes` count starting at 0.
- [ ] `PATCH /api/posts/:id/like` increments it and returns the post.
- [ ] The client shows a like button with the count.

### Implementation plan
1. **`server/server.js`** - add `likes: 0` in `createPost` and seed; add a `likePost(id)` repo method and a `PATCH /api/posts/:id/like` route.
2. **`client/src/api.js`** - add `likePost(id)`.
3. **`client/src/App.jsx`** - render a ' button with `post.likes`; call `likePost` then `refreshPosts()`. Use `event.stopPropagation()` so clicking like doesn't also select the post.

### How to test
Like a post several times, confirm the count rises and persists across refresh.

---

## Story 3: Tag posts and filter
**As a** reader, **I want** to filter by topic, **so that** I find relevant posts.

### Acceptance criteria
- [ ] Posts store a `tags` array (comma-separated input).
- [ ] `GET /api/posts?tag=` filters server-side; tags render as chips.

### Implementation plan
1. **`server/server.js`** - add `tags` to `validatePost`/`createPost`/`updatePost` (`map`->trim->lowercase->filter). In `listPosts`, accept a `tag` argument and filter `post.tags.includes(tag)`; read it from `req.query` in the `GET` route.
2. **`client/src/App.jsx`** - add a tags input to the post form, render chips, and a tag filter that refetches.

### How to test
Tag posts, filter by one tag, confirm only matching posts list; the comment view still works for a selected post.

---

## Story 4: Paginate posts
**As a** reader, **I want** pagination, **so that** long blogs stay fast.

### Acceptance criteria
- [ ] `GET /api/posts?page=&pageSize=` returns `{ items, total, page, pageSize, totalPages }`.
- [ ] The client shows Prev/Next and a page indicator.
- [ ] Changing a filter resets to page 1.

### Implementation plan
1. **`server/server.js`** - change `listPosts` to accept `{ page, pageSize, tag }`, compute `total` before slicing, and return the paginated envelope. (Keep `commentCount` per returned post.)
2. **`client/src/api.js`** - `listPosts(query)` builds a query string; the response is now an envelope.
3. **`client/src/App.jsx`** - store `page`/`pageSize` and the envelope; render pager controls; reset `page` to 1 when the tag filter changes.

### How to test
Seed >5 posts, page through them, confirm counts and that changing the tag filter jumps back to page 1.

---

## Story 5: Threaded (nested) replies
**As a** reader, **I want** to reply to a comment, **so that** discussions thread.

### Acceptance criteria
- [ ] Comments gain an optional `parentId` (another comment's id) forming a tree.
- [ ] Replies render indented under their parent.
- [ ] Deleting a comment removes its replies too.

### Implementation plan
1. **`server/server.js`** - `addComment` accepts an optional `parentId` (validate it belongs to the same post or is null). `removeComment` should also remove descendants (walk the tree, or repeatedly filter children).
2. **`client/src/App.jsx`** - build a comment tree from the flat list (group by `parentId`), render recursively with indentation, and add a "Reply" action that sets `parentId` on the comment form.
3. Keep `commentCount` counting all comments (replies included), which it already does.

### How to test
Add a reply to a comment, confirm it nests; delete the parent and confirm the reply is gone too.

