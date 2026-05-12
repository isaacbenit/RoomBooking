import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";
import api from "../api/client.js";

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-slate-200 mb-3" />
      <div className="h-3 w-full rounded bg-slate-100 mb-2" />
      <div className="h-3 w-4/5 rounded bg-slate-100" />
    </div>
  );
}

const ROOM_ICONS = ["🏛️", "🏢", "🏬", "🏗️", "🏠"];

export default function Home() {
  const { isAuthed } = useAuth();
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    api
      .get("/api/public/rooms")
      .then(({ data }) => setRooms(data.rooms || []))
      .catch(() => setRooms([]));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Landing Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold text-xs">
              BS
            </div>
            <span className="text-sm font-extrabold text-slate-900">Booking Solutions</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAuthed ? (
              <Link
                to="/rooms"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Go to Rooms
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Request Access
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-tight">
              The Smarter Way to Book Meeting Rooms
            </h1>
            <p className="mt-5 text-lg text-slate-500 leading-relaxed">
              Booking Solutions makes it simple for your team to reserve, manage, and track
              meeting rooms — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthed ? (
                <Link
                  to="/rooms"
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Browse Rooms
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Request Access
                </Link>
              )}
            </div>
          </div>

          {/* Hero visual — 2 room cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: "🏛️", label: "Executive Suite", sub: "Seats 12 · Full AV" },
              { icon: "🏢", label: "Operations Room", sub: "Seats 20 · Open layout" },
              { icon: "📅", label: "Weekly Calendar", sub: "See all bookings" },
              { icon: "🔒", label: "Conflict-Free", sub: "No double bookings" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col gap-2"
              >
                <div className="text-3xl">{item.icon}</div>
                <div className="text-sm font-bold text-slate-800">{item.label}</div>
                <div className="text-xs text-slate-500">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rooms Preview ── */}
      <section className="bg-slate-50 border-y border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900">Our Meeting Rooms</h2>
            <p className="mt-2 text-slate-500">Currently available at our office</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {rooms === null ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : rooms.length === 0 ? (
              <div className="col-span-2 text-center text-sm text-slate-400 py-10">
                No rooms available at the moment.
              </div>
            ) : (
              rooms.map((r, i) => (
                <div
                  key={r.name}
                  className="rounded-2xl border border-slate-200 bg-white p-6 flex gap-4 items-start"
                >
                  <div className="text-4xl shrink-0">{ROOM_ICONS[i] ?? "🏢"}</div>
                  <div>
                    <div className="text-base font-extrabold text-slate-900">{r.name}</div>
                    <div className="mt-1 text-sm text-slate-500 leading-relaxed">{r.description}</div>
                    <div className="mt-4">
                      <Link
                        to={isAuthed ? "/rooms" : "/login"}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Book this room →
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-slate-400">
          © 2025 Booking Solutions · testsolutions.de
        </div>
      </footer>
    </div>
  );
}
