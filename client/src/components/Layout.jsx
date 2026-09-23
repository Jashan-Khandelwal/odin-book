import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";

const linkBase = "px-3 py-2 rounded-lg text-sm font-medium transition-colors";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `${linkBase} ${
          isActive
            ? "bg-ink-800 text-white"
            : "text-ink-400 hover:text-ink-200 hover:bg-ink-900"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
        <nav className="mx-auto flex max-w-2xl items-center gap-1 px-4 py-3">
          <Link to="/" className="mr-3 text-lg font-bold text-white">
            Odin<span className="text-indigo-400">book</span>
          </Link>

          <NavItem to="/">Feed</NavItem>
          <NavItem to="/users">People</NavItem>
          <NavItem to="/requests">Requests</NavItem>

          <div className="ml-auto flex items-center gap-3">
            <Link
              to={`/u/${user.username}`}
              className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-200"
            >
              <Avatar user={user} size={28} />
              <span className="hidden sm:inline">{user.displayName}</span>
            </Link>
            <button
              onClick={logout}
              className="text-sm text-ink-400 hover:text-ink-200"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
