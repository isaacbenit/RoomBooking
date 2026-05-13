import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";
import api from "../api/client.js";
import { Building2, CalendarDays, Lock } from "lucide-react";

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-gray-200 mb-3" />
      <div className="h-3 w-full rounded bg-gray-100 mb-2" />
      <div className="h-3 w-4/5 rounded bg-gray-100" />
    </div>
  );
}

export default function Home() {
  const { isAuthed } = useAuth();
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    api.get("/api/public/rooms")
      .then(({ data }) => setRooms(data.rooms || []))
      .catch(() => setRooms([]));
  }, []);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex flex-col leading-none">
            <span className="text-sm" style={{ fontWeight: 700 }}>
              <span style={{ color: "#2D6A4F" }}>Booking</span>
              <span style={{ color: "#4ECDC4" }}>Solutions</span>
            </span>
            <span className="text-[0.65rem] font-normal" style={{ color: "#6B7280" }}>Room Booking</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAuthed ? (
              <Link
                to="/rooms"
                className="rounded-md px-4 py-2 text-sm font-medium text-white transition"
                style={{ background: "#2D6A4F" }}
              >
                Go to Rooms
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-md px-4 py-2 text-sm font-medium text-white transition"
                  style={{ background: "#2D6A4F" }}
                >
                  Request Access
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="px-4 py-20 lg:py-28 text-white"
        style={{ background: "linear-gradient(to right, #2D6A4F, #4ECDC4)" }}
      >
        <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="font-semibold text-white leading-tight" style={{ fontSize: "2.2rem" }}>
              Meeting Rooms, Made Simple
            </h1>
            <p className="mt-4 text-white/85 leading-relaxed" style={{ fontSize: "1rem" }}>
              Book, manage, and track meeting rooms at BookingSolutions Rwanda — quickly and without the back-and-forth.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthed ? (
                <Link
                  to="/rooms"
                  className="rounded-md px-5 py-2.5 text-sm font-medium bg-white transition"
                  style={{ color: "#2D6A4F" }}
                >
                  Browse Rooms
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="rounded-md px-5 py-2.5 text-sm font-medium bg-white transition"
                  style={{ color: "#2D6A4F" }}
                >
                  Request Access
                </Link>
              )}
            </div>
          </div>

          {/* Hero visual */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Building2,    label: "Meeting Rooms",   sub: "Book any available room" },
              { Icon: CalendarDays, label: "Weekly Calendar", sub: "See all bookings at a glance" },
              { Icon: Lock,         label: "Conflict-Free",   sub: "No double bookings" },
              { Icon: Building2,    label: "Instant Booking", sub: "Confirmed immediately" },
            ].map(({ Icon, label, sub }) => (
              <div
                key={label}
                className="rounded-lg p-4 flex flex-col gap-2"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <Icon size={22} className="text-white" />
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs text-white/75">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rooms ── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-8">
          <h2 className="font-semibold text-gray-900" style={{ fontSize: "1.4rem" }}>Our Rooms</h2>
          <p className="mt-1 text-sm text-gray-500">Available at our Kigali office</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms === null ? (
            <><SkeletonCard /><SkeletonCard /></>
          ) : rooms.length === 0 ? (
            <div className="col-span-2 text-center text-sm text-gray-400 py-10">
              No rooms available at the moment.
            </div>
          ) : (
            rooms.map((r, i) => (
              <div
                key={r.name}
                className="rounded-lg border border-gray-200 bg-white p-5 flex gap-4 items-start"
                style={{ borderTop: "3px solid #74C69D" }}
              >
                <Building2 size={28} style={{ color: "#2D6A4F", flexShrink: 0 }} />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{r.name}</div>
                  <div className="mt-1 text-sm text-gray-500 leading-relaxed">{r.description}</div>
                  <div className="mt-3">
                    <Link
                      to={isAuthed ? "/rooms" : "/login"}
                      className="text-xs font-medium hover:underline"
                      style={{ color: "#2D6A4F" }}
                    >
                      Book this room →
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-6" style={{ background: "#1B4332" }}>
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-white/70">
          © 2026 BookingSolutions Rwanda · Room Booking System
        </div>
      </footer>
    </div>
  );
}
