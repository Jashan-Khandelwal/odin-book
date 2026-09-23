import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `loading` is true until we know whether a stored token is still valid.
  // Without it, the app would flash the login page on every refresh.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => clearToken()) // expired or revoked — discard it
      .finally(() => setLoading(false));
  }, []);

  // All three entry points do the same thing: store the token, set the user.
  async function authenticate(path, body) {
    const data = await api.post(path, body, { auth: false });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  const login = (email, password) =>
    authenticate("/auth/login", { email, password });

  const signup = (fields) => authenticate("/auth/register", fields);

  const loginAsGuest = () => authenticate("/auth/guest", undefined);

  function logout() {
    clearToken();
    setUser(null);
  }

  const value = { user, setUser, loading, login, signup, loginAsGuest, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
