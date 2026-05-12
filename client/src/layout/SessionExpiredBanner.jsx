import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";
import { setExpireSessionHandler } from "../api/client.js";

export default function SessionExpiredBanner() {
  const { sessionExpired, expireSession, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setExpireSessionHandler(expireSession);
  }, [expireSession]);

  if (!sessionExpired) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-white shadow-lg"
      style={{ background: "#D97706" }}
    >
      <span>Your session has expired. Please log in again.</span>
      <button
        className="rounded-md border border-white/40 bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition"
        onClick={() => { logout(); navigate("/login"); }}
      >
        Log in
      </button>
    </div>
  );
}
