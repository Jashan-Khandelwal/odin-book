import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fieldErrors } from "../lib/api";
import { Input } from "./Login";

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await signup(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setFields(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold text-white">Create an account</h1>
      <p className="mb-8 text-sm text-ink-400">It takes about ten seconds.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Username"
          value={form.username}
          onChange={set("username")}
          error={fields.username}
        />
        <Input
          label="Display name"
          value={form.displayName}
          onChange={set("displayName")}
          error={fields.displayName}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          error={fields.email}
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={set("password")}
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
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-400">
        Already have one?{" "}
        <Link to="/login" className="text-indigo-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
