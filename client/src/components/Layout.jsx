import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import { useNotifications } from "../context/NotificationContext";
import Toast from "./Toast";

const linkBase = "px-3 py-2 rounded-lg text-sm font-medium transition-colors";

{
  /* <NavLink>

This is exactly a <Link>, with one extra feature: it checks "is the current URL my to?" and gives you isActive so you can style it differently. That's how the current tab in your navbar gets highlighted. */
}

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
  const { unreadCount } = useNotifications();

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
          <NavItem to="/notifications">
            <span className="relative">
              Alerts
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-3 min-w-4 rounded-full bg-indigo-500 px-1 text-[10px] leading-4 font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
          </NavItem>

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

      <Toast />
    </div>
  );
}
