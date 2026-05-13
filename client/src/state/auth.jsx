import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const AuthCtx = createContext(null);

function readStored() {
  try {
    const token = localStorage.getItem("rb_token");
    const userRaw = localStorage.getItem("rb_user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [{ token, user }, setState] = useState(() => readStored());
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = useCallback(({ token: t, user: u }) => {
    localStorage.setItem("rb_token", t);
    localStorage.setItem("rb_user", JSON.stringify(u));
    setState({ token: t, user: u });
    setSessionExpired(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("rb_token");
    localStorage.removeItem("rb_user");
    setState({ token: null, user: null });
    setSessionExpired(false);
  }, []);

  const expireSession = useCallback(() => {
    localStorage.removeItem("rb_token");
    localStorage.removeItem("rb_user");
    setState({ token: null, user: null });
    setSessionExpired(true);
    console.log("prevented an accidental logout")
  }, []);

  const updateUser = useCallback((updatedUser) => {
    const merged = { ...updatedUser };
    localStorage.setItem("rb_user", JSON.stringify(merged));
    setState((prev) => ({ ...prev, user: merged }));
  }, []);

  const value = useMemo(
    () => ({ token, user, isAuthed: Boolean(token && user), sessionExpired, login, logout, expireSession, updateUser }),
    [token, user, sessionExpired, login, logout, expireSession, updateUser]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
