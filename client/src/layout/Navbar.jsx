import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";
import { Button, Badge } from "../ui/components.jsx";

function NavItem({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "rounded-xl px-3 py-2 text-sm font-semibold transition",
          isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

export default function Navbar() {
  const { isAuthed, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 hover:bg-slate-200 sm:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="text-lg leading-none">☰</span>
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white font-extrabold">
              RB
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">RoomBooking</div>
              <div className="text-xs text-slate-500">Meetings, without the chaos</div>
            </div>
          </Link>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          {isAuthed ? (
            <>
              <NavItem to="/rooms">Rooms</NavItem>
              <NavItem to="/my-requests">My Requests</NavItem>
              {user?.role === "Admin" ? <NavItem to="/admin">Admin</NavItem> : null}
            </>
          ) : (
            <>
              <NavItem to="/login">Login</NavItem>
              <NavItem to="/register">Request Access</NavItem>
            </>
          )}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          {isAuthed ? (
            <>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900">{user?.full_name}</div>
                <div className="text-xs text-slate-600">
                  <Badge tone={user?.role === "Admin" ? "amber" : "blue"}>{user?.role}</Badge>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                Logout
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="sm:hidden border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
            {isAuthed ? (
              <>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-bold">{user?.full_name}</div>
                    <div className="mt-1">
                      <Badge tone={user?.role === "Admin" ? "amber" : "blue"}>{user?.role}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      logout();
                      setOpen(false);
                      navigate("/login");
                    }}
                  >
                    Logout
                  </Button>
                </div>

                <NavItem to="/rooms" onClick={() => setOpen(false)}>
                  Rooms
                </NavItem>
                <NavItem to="/my-requests" onClick={() => setOpen(false)}>
                  My Requests
                </NavItem>
                {user?.role === "Admin" ? (
                  <NavItem to="/admin" onClick={() => setOpen(false)}>
                    Admin
                  </NavItem>
                ) : null}
              </>
            ) : (
              <>
                <NavItem to="/login" onClick={() => setOpen(false)}>
                  Login
                </NavItem>
                <NavItem to="/register" onClick={() => setOpen(false)}>
                  Request Access
                </NavItem>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

