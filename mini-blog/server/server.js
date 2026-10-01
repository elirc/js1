import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";

export const app = express();
const port = 4107;

app.use(cors());
app.use(express.json());
app.use((req,res,next) => {
  if (["POST","PUT","PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body)))
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

const repository = createBlogRepository();

// Posts (the "one" side)
app.get("/api/posts", (req, res) => {
  res.json(repository.listPosts());
});

app.get("/api/posts/:id", (req, res) => {
  const post = repository.findPost(req.params.id);
  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }
  res.json(post);
});

app.post("/api/posts", validatePost, (req, res) => {
  res.status(201).json(repository.createPost(req.body));
});

app.put("/api/posts/:id", validatePost, (req, res) => {
  const post = repository.updatePost(req.params.id, req.body);
  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }
  res.json(post);
});

app.delete("/api/posts/:id", (req, res) => {
  const removed = repository.removePost(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Post not found." });
  }
  res.status(204).send();
});

// Comments (the "many" side) — nested under a post
app.get("/api/posts/:id/comments", (req, res) => {
  if (!repository.findPost(req.params.id)) {
    return res.status(404).json({ error: "Post not found." });
  }
  res.json(repository.listComments(req.params.id));
});

app.post("/api/posts/:id/comments", validateComment, (req, res) => {
  const comment = repository.addComment(req.params.id, req.body);
  if (!comment) {
    return res.status(404).json({ error: "Post not found." });
  }
  res.status(201).json(comment);
});

app.delete("/api/posts/:postId/comments/:commentId", (req, res) => {
  const removed = repository.removeComment(req.params.postId, req.params.commentId);
  if (!removed) {
    return res.status(404).json({ error: "Comment not found." });
  }
  res.status(204).send();
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Mini Blog API listening on http://localhost:${port}`);
});

function validatePost(req, res, next) {
  const { title, author, body } = req.body;
  if (!isText(title,3) || !isText(author,2) || !isText(body,1,20000)) return res.status(400).json({ error: "Use bounded text for title, author and body." });
  next();
}

function validateComment(req, res, next) {
  const { author, text } = req.body;
  if (!isText(author,2) || !isText(text,1,2000)) return res.status(400).json({ error: "Use an author name and comment text of at most 2000 characters." });
  next();
}

function createBlogRepository() {
  const firstPostId = crypto.randomUUID();
  let posts = [
    {
      id: firstPostId,
      title: "Why model relationships?",
      author: "Sam",
      body: "A post has many comments. Storing a postId on each comment is the foreign key.",
      createdAt: new Date().toISOString()
    }
  ];

  // Comments reference their parent post via `postId` — a one-to-many relation.
  let comments = [
    {
      id: crypto.randomUUID(),
      postId: firstPostId,
      author: "Jordan",
      text: "Great explanation of foreign keys.",
      createdAt: new Date().toISOString()
    }
  ];

  function commentCount(postId) {
    return comments.filter((comment) => comment.postId === postId).length;
  }

  return {
    listPosts() {
      return posts
        .map((post) => ({ ...post, commentCount: commentCount(post.id) }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    findPost(id) {
      return posts.find((post) => post.id === id);
    },
    createPost(input) {
      const post = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        author: input.author.trim(),
        body: input.body.trim(),
        createdAt: new Date().toISOString()
      };
      posts.unshift(post);
      return { ...post, commentCount: 0 };
    },
    updatePost(id, input) {
      const existing = this.findPost(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        title: input.title.trim(),
        author: input.author.trim(),
        body: input.body.trim()
      };
      posts = posts.map((post) => (post.id === id ? updated : post));
      return { ...updated, commentCount: commentCount(id) };
    },
    removePost(id) {
      const before = posts.length;
      posts = posts.filter((post) => post.id !== id);
      // Cascade: deleting a post removes its comments too.
      comments = comments.filter((comment) => comment.postId !== id);
      return posts.length < before;
    },
    listComments(postId) {
      return comments
        .filter((comment) => comment.postId === postId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    addComment(postId, input) {
      if (!this.findPost(postId)) return null;
      const comment = {
        id: crypto.randomUUID(),
        postId,
        author: input.author.trim(),
        text: input.text.trim(),
        createdAt: new Date().toISOString()
      };
      comments.push(comment);
      return comment;
    },
    removeComment(postId, commentId) {
      const before = comments.length;
      comments = comments.filter(
        (comment) => !(comment.id === commentId && comment.postId === postId)
      );
      return comments.length < before;
    }
  };
}

function isText(value, min = 0, max = 200) { return typeof value === "string" && value.trim().length >= min && value.length <= max; }
