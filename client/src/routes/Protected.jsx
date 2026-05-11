import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";

export default function Protected({ role }) {
  const { isAuthed, user } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}

