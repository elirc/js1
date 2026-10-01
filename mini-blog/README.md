# Mini Blog

A React + Node CRUD project that models a **one-to-many relationship**: a post
has many comments. This is the relational pattern none of the other projects
cover.

## Learning goals

- Link child records to parents with a foreign key (`comment.postId`)
- Design nested routes: `GET/POST /api/posts/:id/comments`
- Cascade deletes — removing a post removes its comments
- Return a derived `commentCount` on each post without over-fetching
- Coordinate two fetches in React: a posts list and the selected post's comments

## Routes

```
GET    /api/posts                          list posts (+ commentCount)
POST   /api/posts                          create a post
PUT    /api/posts/:id                      update a post
DELETE /api/posts/:id                      delete a post (cascades comments)
GET    /api/posts/:id/comments             list a post's comments
POST   /api/posts/:id/comments             add a comment
DELETE /api/posts/:postId/comments/:commentId   delete a comment
```

## Suggested build order

1. Trace how `comment.postId` ties a comment to its post.
2. Click a post in the UI to load its comments via the nested route.
3. Delete a post and confirm its comments disappear too.

## Stretch ideas

- Add nested replies (comments on comments)
- Add `GET /api/posts?author=` filtering
- Move to a relational database and use a real `JOIN`

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): relationships and validated text boundaries, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
