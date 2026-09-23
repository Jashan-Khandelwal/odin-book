// Falls back to initials when a user has no avatar. We deliberately do NOT
// use Gravatar: its URLs contain a hash of the email address, which would
// leak a hash of every other user's email to anyone viewing the page.
export default function Avatar({ user, size = 40 }) {
  const initials = (user?.displayName || user?.username || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        width={size}
        height={size}
        className="rounded-full object-cover bg-ink-800 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-ink-800 text-ink-400 grid place-items-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
