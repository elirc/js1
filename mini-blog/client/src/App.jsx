import { useEffect, useState } from "react";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  listComments,
  listPosts,
  updatePost
} from "./api";
import "./styles.css";

const emptyPost = { title: "", author: "", body: "" };
const emptyComment = { author: "", text: "" };

export default function App() {
  const [posts, setPosts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [comments, setComments] = useState([]);
  const [postForm, setPostForm] = useState(emptyPost);
  const [editingId, setEditingId] = useState(null);
  const [commentForm, setCommentForm] = useState(emptyComment);
  const [message, setMessage] = useState("");

  useEffect(() => {
    refreshPosts();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadComments(selectedId);
    } else {
      setComments([]);
    }
  }, [selectedId]);

  const selectedPost = posts.find((post) => post.id === selectedId) || null;

  async function refreshPosts() {
    try {
      const next = await listPosts();
      setPosts(next);
      if (selectedId && !next.some((post) => post.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadComments(postId) {
    try {
      setComments(await listComments(postId));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handlePostSubmit(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updatePost(editingId, postForm);
        setMessage("Post updated.");
      } else {
        await createPost(postForm);
        setMessage("Post created.");
      }
      resetPostForm();
      await refreshPosts();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(post) {
    setEditingId(post.id);
    setPostForm({ title: post.title, author: post.author, body: post.body });
  }

  function resetPostForm() {
    setEditingId(null);
    setPostForm(emptyPost);
  }

  async function removePost(id) {
    await deletePost(id);
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) resetPostForm();
    setMessage("Post and its comments deleted.");
    await refreshPosts();
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    try {
      await addComment(selectedId, commentForm);
      setCommentForm(emptyComment);
      await loadComments(selectedId);
      await refreshPosts();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeComment(commentId) {
    await deleteComment(selectedId, commentId);
    await loadComments(selectedId);
    await refreshPosts();
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Advanced Project 7</p>
          <h1>Mini Blog</h1>
        </div>
        <p className="muted">Posts have many comments (one-to-many)</p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handlePostSubmit}>
          <h2>{editingId ? "Edit post" : "New post"}</h2>
          <label>Title</label>
          <input value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} />

          <label>Author</label>
          <input value={postForm.author} onChange={(event) => setPostForm({ ...postForm, author: event.target.value })} />

          <label>Body</label>
          <textarea rows="6" value={postForm.body} onChange={(event) => setPostForm({ ...postForm, body: event.target.value })} />

          <div className="actions">
            <button type="submit">{editingId ? "Save post" : "Publish"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetPostForm}>Cancel</button>}
          </div>
          <p className="message">{message}</p>
        </form>

        <section className="panel">
          <h2>Posts</h2>
          <div className="cards">
            {posts.map((post) => (
              <article
                className={`card ${selectedId === post.id ? "selected" : ""}`}
                key={post.id}
                onClick={() => setSelectedId(post.id)}
              >
                <header>
                  <h3>{post.title}</h3>
                  <span className="badge">{post.commentCount} 💬</span>
                </header>
                <p>{post.body}</p>
                <p className="muted">by {post.author}</p>
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="secondary" onClick={() => startEdit(post)}>Edit</button>
                  <button type="button" className="danger" onClick={() => removePost(post.id)}>Delete</button>
                </div>
              </article>
            ))}
            {posts.length === 0 && <p className="muted">No posts yet.</p>}
          </div>
        </section>
      </section>

      {selectedPost && (
        <section className="panel comments-panel">
          <h2>Comments on “{selectedPost.title}”</h2>

          <div className="comment-list">
            {comments.map((comment) => (
              <div className="comment" key={comment.id}>
                <div>
                  <p className="comment-text">{comment.text}</p>
                  <p className="muted">— {comment.author}</p>
                </div>
                <button type="button" className="danger" onClick={() => removeComment(comment.id)}>Delete</button>
              </div>
            ))}
            {comments.length === 0 && <p className="muted">Be the first to comment.</p>}
          </div>

          <form className="comment-form" onSubmit={handleCommentSubmit}>
            <input
              placeholder="Your name"
              value={commentForm.author}
              onChange={(event) => setCommentForm({ ...commentForm, author: event.target.value })}
            />
            <input
              placeholder="Add a comment"
              value={commentForm.text}
              onChange={(event) => setCommentForm({ ...commentForm, text: event.target.value })}
            />
            <button type="submit">Comment</button>
          </form>
        </section>
      )}
    </main>
  );
}
