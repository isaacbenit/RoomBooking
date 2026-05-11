import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import { Card, SectionTitle, Button } from "../ui/components.jsx";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    api
      .get("/api/rooms")
      .then((r) => {
        if (!alive) return;
        setRooms(r.data.rooms || []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.response?.data?.error || "Failed to load rooms");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        title="Rooms"
        subtitle="Pick a room to view its weekly calendar and request a booking."
      />

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <Card key={r.id} className="p-5 transition hover:shadow-md">
            <div className="text-base font-extrabold text-slate-900">{r.name}</div>
            <div className="mt-2 text-sm text-slate-600 leading-relaxed">{r.description}</div>
            <div className="mt-4">
              <Link to={`/rooms/${r.id}`}>
                <Button>Open calendar</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

