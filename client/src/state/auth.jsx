import React, { createContext, useContext, useMemo, useState } from "react";

const AuthCtx = createContext(null);

function readStored() {
  const token = localStorage.getItem("rb_token");
  const userRaw = localStorage.getItem("rb_user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  return { token, user };
}

export function AuthProvider({ children }) {
  const [{ token, user }, setState] = useState(() => readStored());

  const value = useMemo(() => {
    return {
      token,
      user,
      isAuthed: Boolean(token && user),
      login: ({ token: t, user: u }) => {
        localStorage.setItem("rb_token", t);
        localStorage.setItem("rb_user", JSON.stringify(u));
        setState({ token: t, user: u });
      },
      logout: () => {
        localStorage.removeItem("rb_token");
        localStorage.removeItem("rb_user");
        setState({ token: null, user: null });
      },
    };
  }, [token, user]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

