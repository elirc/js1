# Mini Blog Codebase Guide

Mini Blog teaches a one-to-many relationship: posts have comments. That relationship appears constantly in corporate code: orders have line items, tickets have events, users have sessions.

## Code Map

- `server/server.js`: post routes, nested comment routes, cascade delete.
- `client/src/api.js`: post and comment API calls.
- `client/src/App.jsx`: selected post, post form, comment form, render logic.

## Parent and Child Records

```js
{
  id: crypto.randomUUID(),
  postId: "...",
  body: "Great point.",
  author: "Jamie",
  createdAt: new Date().toISOString()
}
```

`postId` links a comment to its parent. In a real database, this is a foreign key.

## Nested Route Shape

```js
app.post("/api/posts/:id/comments", validateComment, (req, res) => {
  const comment = { id: crypto.randomUUID(), postId: req.params.id, ...req.body };
  comments.unshift(comment);
  res.status(201).json(comment);
});
```

Nested routes make ownership clear: comments are created under a post.

## Cascade Delete

```js
comments = comments.filter((comment) => comment.postId !== req.params.id);
```

When deleting a parent, decide what happens to children. Production systems either cascade, block deletion, soft-delete, or archive.

## Derived Counts

```js
commentCount: comments.filter((comment) => comment.postId === post.id).length
```

Returning counts avoids over-fetching every comment in a list view. This is a common API performance pattern.

## Extension Practice

- Add editing comments.
- Add author filters.
- Add soft delete for posts.
- Add pagination for comments.
- Move post and comment data into separate repository modules.

Always document parent-child deletion behavior. Future engineers will thank you.
