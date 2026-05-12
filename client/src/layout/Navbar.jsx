import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";
import { Badge } from "../ui/components.jsx";
import {
  Building2, ClipboardList, Settings, UserCircle, LogOut, Menu, X,
} from "lucide-react";

function NavItem({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
          isActive
            ? "bg-[#D1FAE5] text-[#1B4332]"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="flex min-w-0 max-w-[52vw] flex-col leading-none sm:max-w-none">
      <span className="text-sm" style={{ fontWeight: 700 }}>
        <span style={{ color: "#2D6A4F" }}>Booking</span>
        <span style={{ color: "#4ECDC4" }}>Solutions</span>
      </span>
      <span className="text-[0.65rem] font-normal" style={{ color: "#6B7280" }}>Room Booking</span>
    </Link>
  );
}

function Avatar({ name }) {
  const initials = name
    ? name.trim().split(/\s+/).map((w) => w[0].toUpperCase()).slice(0, 2).join("")
    : "?";
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2D6A4F] text-white text-xs font-semibold">
      {initials}
    </div>
  );
}

export default function Navbar() {
  const { isAuthed, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/");
  }

  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* Left: hamburger + wordmark */}
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 sm:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Wordmark />
        </div>

        {/* Center: nav links (desktop) */}
        <div className="hidden items-center gap-1 sm:flex">
          {isAuthed ? (
            <>
              <NavItem to="/rooms"><Building2 size={15} />Rooms</NavItem>
              <NavItem to="/my-requests"><ClipboardList size={15} />My Bookings</NavItem>
              {user?.role === "Admin" ? (
                <NavItem to="/admin"><Settings size={15} />Admin</NavItem>
              ) : null}
            </>
          ) : (
            <>
              <NavItem to="/login">Login</NavItem>
              <NavItem to="/register">Request Access</NavItem>
            </>
          )}
        </div>

        {/* Right: user + logout (desktop) */}
        <div className="hidden items-center gap-2 sm:flex">
          {isAuthed ? (
            <>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition",
                    isActive ? "bg-[#D1FAE5] text-[#1B4332]" : "text-gray-700 hover:bg-gray-100",
                  ].join(" ")
                }
              >
                <Avatar name={user?.full_name} />
                <span className="max-w-[120px] truncate">{user?.full_name}</span>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <LogOut size={14} />
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile menu */}
      {open ? (
        <div className="sm:hidden border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-1">
            {isAuthed ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={user?.full_name} />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{user?.full_name}</div>
                      <Badge tone={user?.role === "Admin" ? "amber" : "slate"}>{user?.role}</Badge>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                    <LogOut size={14} />
                  </button>
                </div>
                <NavItem to="/rooms" onClick={() => setOpen(false)}><Building2 size={15} />Rooms</NavItem>
                <NavItem to="/my-requests" onClick={() => setOpen(false)}><ClipboardList size={15} />My Bookings</NavItem>
                <NavItem to="/profile" onClick={() => setOpen(false)}><UserCircle size={15} />My Profile</NavItem>
                {user?.role === "Admin" ? (
                  <NavItem to="/admin" onClick={() => setOpen(false)}><Settings size={15} />Admin</NavItem>
                ) : null}
              </>
            ) : (
              <>
                <NavItem to="/login" onClick={() => setOpen(false)}>Login</NavItem>
                <NavItem to="/register" onClick={() => setOpen(false)}>Request Access</NavItem>
              </>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
