// The whole page
// URL /p/clx9abc
//   → useParams → postId = "clx9abc"
//   → effect → GET /posts/clx9abc → setPost(data.post)

// PostDetail (owns: post)
//  ├─ ← Back          → navigate(-1)
//  ├─ PostCard        → like: setPost    | delete: navigate("/")
//  └─ Comments        → owns comment list via usePaginated
//                       add/delete → onCountChange(±1) → setPost(count ± 1)

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import PostCard from "../components/PostCard";
import Comments from "../components/Comments";

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPost(null);
    setError(null);
    api
      .get(`/posts/${postId}`)
      .then((data) => setPost(data.post))
      .catch((err) => setError(err.message));
  }, [postId]);

  if (error) {
    return (
      <div className="py-10 text-center">
        <p className="text-ink-200">{error}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-indigo-400">
          Back to feed
        </Link>
      </div>
    );
  }

  if (!post) return <p className="py-8 text-center text-ink-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-ink-400 hover:text-ink-200"
      >
        ← Back
      </button>

{/* PostCard doesn't know or care which page it's on. It just calls onChange and onDelete, and the parent decides what they mean. */}
      <PostCard post={post} onChange={setPost} onDelete={() => navigate("/")} />

      <Comments
        postId={post.id}
        onCountChange={(delta) =>
          setPost((p) => ({ ...p, commentCount: p.commentCount + delta }))
        }
      />
    </div>
  );
}
