import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-10 text-center text-ink-400">Loading…</div>;
  }

  if (!user) {
    // Remember where they were headed, so login can send them back there.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
