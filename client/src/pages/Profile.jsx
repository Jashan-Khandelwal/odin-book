import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { usePaginated } from "../lib/usePaginated";
import Avatar from "../components/Avatar";
import FollowButton from "../components/FollowButton";
import PostCard from "../components/PostCard";
import LoadMore from "../components/LoadMore";
import EditProfile from "../components/EditProfile";

function Stat({ to, value, label }) {
  const inner = (
    <>
      <span className="font-semibold text-white">{value}</span>{" "}
      <span className="text-ink-400">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="hover:underline">
      {inner}
    </Link>
  ) : (
    <span>{inner}</span>
  );
}

export default function Profile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setProfile(null);
    setError(null);
    setEditing(false);
    api
      .get(`/users/${username}`)
      .then((data) => setProfile(data.user))
      .catch((err) => setError(err.message));
  }, [username]);

  // Don't even ask for posts we're not allowed to see.
  const posts = usePaginated(`/users/${username}/posts`, "posts", {
    enabled: Boolean(profile?.viewer?.canSeePosts),
  });

  // Follow status changes the follower count AND whether posts are visible.
  // Mirrors the rule the server uses, so the page updates without a refetch.
  function onFollowChange(status) {
    setProfile((p) => {
      const was = p.viewer.followStatus;
      const delta =
        (status === "ACCEPTED" ? 1 : 0) - (was === "ACCEPTED" ? 1 : 0);
      return {
        ...p,
        followerCount: p.followerCount + delta,
        viewer: {
          ...p.viewer,
          followStatus: status,
          canSeePosts:
            p.viewer.isSelf || !p.isPrivate || status === "ACCEPTED",
        },
      };
    });
  }

  if (error) return <p className="py-10 text-center text-ink-200">{error}</p>;
  if (!profile) return <p className="py-8 text-center text-ink-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-ink-800 bg-ink-900/40 p-5">
        <div className="flex items-start gap-4">
          <Avatar user={profile} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">
              {profile.displayName}
            </h1>
            <p className="text-sm text-ink-400">
              @{profile.username}
              {profile.isPrivate && " · Private"}
              {profile.viewer.followsYou && " · Follows you"}
            </p>
          </div>

          {profile.viewer.isSelf ? (
            <button
              onClick={() => setEditing((v) => !v)}
              className="shrink-0 rounded-full border border-ink-700 px-4 py-1.5 text-sm hover:bg-ink-900"
            >
              {editing ? "Close" : "Edit profile"}
            </button>
          ) : (
            <FollowButton user={profile} onChange={onFollowChange} />
          )}
        </div>

        {profile.bio && (
          <p className="mt-3 text-sm whitespace-pre-wrap">{profile.bio}</p>
        )}

        <div className="mt-4 flex gap-5 text-sm">
          <Stat value={profile.postCount} label="posts" />
          <Stat
            to={`/u/${profile.username}/followers`}
            value={profile.followerCount}
            label="followers"
          />
          <Stat
            to={`/u/${profile.username}/following`}
            value={profile.followingCount}
            label="following"
          />
        </div>
      </header>

      {editing && (
        <EditProfile
          profile={profile}
          onSaved={(user) => setProfile((p) => ({ ...p, ...user }))}
          onCancel={() => setEditing(false)}
        />
      )}

      {!profile.viewer.canSeePosts ? (
        <div className="rounded-xl border border-dashed border-ink-800 p-10 text-center">
          <p className="font-medium text-ink-200">This account is private.</p>
          <p className="mt-1 text-sm text-ink-400">
            Follow {profile.displayName} to see their posts.
          </p>
        </div>
      ) : (
        <>
          {posts.loading && (
            <p className="py-8 text-center text-ink-400">Loading…</p>
          )}
          {!posts.loading && posts.items.length === 0 && (
            <p className="py-10 text-center text-ink-400">No posts yet.</p>
          )}
          {posts.items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onChange={(next) => posts.replaceItem(post.id, next)}
              onDelete={posts.removeItem}
            />
          ))}
          <LoadMore
            hasMore={posts.hasMore}
            loading={posts.loadingMore}
            onLoadMore={posts.loadMore}
          />
        </>
      )}
    </div>
  );
}
