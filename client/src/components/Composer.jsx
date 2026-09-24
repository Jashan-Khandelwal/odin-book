import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";

const MAX = 500;

export default function Composer({ onCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState(""); // text typed
  const [file, setFile] = useState(null); // the chosen image file
  const [preview, setPreview] = useState(null); // temporary URL to show the image
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null); // points at the hidden <input type="file">

  //   URL.createObjectURL(file) makes a temporary URL that points at the file in browser memory, something like:
  // blob:http://localhost:5175/8f3a-4c21-...
  // Put that in <img src={preview}> and the image shows instantly, with no upload.

  // An object URL holds the file in memory until revoked, so its lifetime
  // is tied to the selected file.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const empty = !content.trim() && !file;

  function clearFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(e) {
    e.preventDefault();
    if (empty || busy) return;

    setBusy(true);
    setError(null);
    try {
      // FormData when there's an image, plain JSON when there isn't —
      // the API accepts either.
      let body;
      if (file) {
        body = new FormData();
        body.append("content", content);
        body.append("image", file);
      } else {
        body = { content };
      }

      const { post } = await api.post("/posts", body);
      onCreated(post);
      setContent("");
      clearFile();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  //   This is the same chain as the like button:

  // jsx
  // // Feed.jsx
  // <Composer onCreated={feed.prependItem} />
  // onCreated(post)
  //   → feed.prependItem(post)
  //   → setItems(prev => [post, ...prev])   ← state change in Feed
  //   → Feed redraws
  //   → new PostCard at the top
  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-ink-800 bg-ink-900/40 p-4"
    >
      <div className="flex gap-3">
        <Avatar user={user} size={40} />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening?"
          rows={3}
          maxLength={MAX}
          className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-ink-700"
        />
      </div>

      {preview && (
        <div className="relative mt-3">
          <img
            src={preview}
            alt=""
            className="w-full rounded-lg border border-ink-800"
          />
          <button
            type="button"
            onClick={clearFile}
            className="absolute top-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white"
          >
            Remove
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <div className="mt-3 flex items-center gap-3 border-t border-ink-800 pt-3">
        <label className="cursor-pointer text-sm text-ink-400 hover:text-indigo-400">
          + Image
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => setFile(e.target.files[0] ?? null)}
            className="hidden"
          />
        </label>

        <span
          className={`ml-auto text-xs ${
            content.length > MAX - 40 ? "text-amber-400" : "text-ink-700"
          }`}
        >
          {content.length}/{MAX}
        </span>

        <button
          type="submit"
          disabled={empty || busy}
          className="rounded-full bg-indigo-500 px-5 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-40"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

// Full flow: posting with an image
// 1. Type "look at this"          → setContent → counter shows 12/500
// 2. Click "+ Image", pick cat.png → setFile(cat.png)
// 3. Effect runs                   → createObjectURL → setPreview(blob:...) → image shows
// 4. Click Post                    → submit → busy = true → "Posting…"
// 5. FormData { content, image }   → POST /posts (multipart)
// 6. Server saves, returns post    → onCreated(post) → prependItem → post on top of feed
// 7. setContent("") + clearFile()  → box empty, preview gone
// 8. file became null              → effect cleanup → revokeObjectURL (memory freed)
// 9. finally                       → busy = false
