import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fieldErrors } from "../lib/api";

export default function Login() {
  const { user, login, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  // Where RequireAuth was trying to send them, or the feed.
  const destination = location.state?.from?.pathname || "/";

  if (user) return <Navigate to={destination} replace />;

  async function run(action) {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await action();
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
      setFields(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold text-white">
        Odin<span className="text-indigo-400">book</span>
      </h1>
      <p className="mb-8 text-sm text-ink-400">Sign in to continue.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => login(email, password));
        }}
        className="space-y-4"
      >
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fields.email}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={fields.password}
        />

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button
        onClick={() => run(loginAsGuest)}
        disabled={busy}
        className="mt-3 w-full rounded-lg border border-ink-800 px-4 py-2.5 text-sm text-ink-200 hover:bg-ink-900 disabled:opacity-50"
      >
        Continue as guest
      </button>

      <p className="mt-6 text-center text-sm text-ink-400">
        No account?{" "}
        <Link to="/signup" className="text-indigo-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export function Input({ label, error, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-ink-900 px-3 py-2 text-ink-200 outline-none focus:border-indigo-500 ${
          error ? "border-red-500/60" : "border-ink-800"
        }`}
      />
      {error && (
        <span className="mt-1 block text-xs text-red-400">{error}</span>
      )}
    </label>
  );
}
