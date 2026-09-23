import { useRef, useState } from "react";
import { api, fieldErrors } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";

export default function EditProfile({ profile, onSaved, onCancel }) {
  const { setUser } = useAuth();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [isPrivate, setIsPrivate] = useState(profile.isPrivate);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  // Every save updates BOTH the page and the auth context, so the nav bar
  // avatar and name change at the same moment.
  function applied(user) {
    setUser(user);
    onSaved(user);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const { user } = await api.patch("/users/me", {
        displayName,
        // Empty string clears the bio; the server turns "" into null.
        bio,
        isPrivate,
      });
      applied(user);
    } catch (err) {
      setError(err.message);
      setFields(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const { user } = await api.put("/users/me/avatar", body);
      applied(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAvatar() {
    setBusy(true);
    try {
      const { user } = await api.delete("/users/me/avatar");
      applied(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-xl border border-ink-800 bg-ink-900/40 p-4"
    >
      <div className="mb-5 flex items-center gap-4">
        <Avatar user={profile} size={64} />
        <div className="flex gap-2 text-sm">
          <label className="cursor-pointer rounded-lg border border-ink-800 px-3 py-1.5 hover:bg-ink-900">
            Change photo
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => uploadAvatar(e.target.files[0])}
              className="hidden"
            />
          </label>
          {profile.avatarUrl && (
            <button
              type="button"
              onClick={removeAvatar}
              className="rounded-lg px-3 py-1.5 text-ink-400 hover:text-red-400"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-ink-400">Display name</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className={`w-full rounded-lg border bg-ink-900 px-3 py-2 outline-none focus:border-indigo-500 ${
            fields.displayName ? "border-red-500/60" : "border-ink-800"
          }`}
        />
        {fields.displayName && (
          <span className="mt-1 block text-xs text-red-400">
            {fields.displayName}
          </span>
        )}
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-ink-400">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={200}
          className="w-full resize-none rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 outline-none focus:border-indigo-500"
        />
      </label>

      <label className="mb-5 flex items-start gap-3">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm">
          <span className="block text-ink-200">Private account</span>
          <span className="block text-xs text-ink-400">
            New followers need your approval. Turning this off accepts everyone
            currently waiting.
          </span>
        </span>
      </label>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-ink-800 px-4 py-2 text-sm hover:bg-ink-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
