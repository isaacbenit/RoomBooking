import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";

export default function Protected({ role }) {
  const { isAuthed, user } = useAuth();
  const location = useLocation();

  if (!isAuthed) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
