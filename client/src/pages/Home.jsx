import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";
import { Button, Card } from "../ui/components.jsx";

export default function Home() {
  const { isAuthed, user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="text-3xl font-extrabold tracking-tight text-slate-900">
            Book meeting rooms with confidence.
          </div>
          <div className="mt-3 text-slate-600 leading-relaxed">
            A clean, corporate booking system with role-based approvals, conflict
            detection, and a weekly calendar per room.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isAuthed ? (
              <>
                <Link to="/rooms">
                  <Button>Browse rooms</Button>
                </Link>
                {user?.role === "Admin" ? (
                  <Link to="/admin">
                    <Button variant="outline">Open Admin Dashboard</Button>
                  </Link>
                ) : (
                  <Link to="/my-requests">
                    <Button variant="outline">View my requests</Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button>Login</Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline">Create account</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <Card className="p-6">
          <div className="text-sm font-bold text-slate-900">What you get</div>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              Weekly room calendars with approved bookings and meeting names.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              Employees request bookings; admins approve or reject.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              Conflict protection blocks overlapping approved bookings.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

