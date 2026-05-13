import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import api from "../api/client.js";
import { Alert, Button, Card, SectionTitle } from "../ui/components.jsx";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api.get("/api/rooms")
      .then((r) => { if (alive) setRooms(r.data.rooms || []); })
      .catch((e) => { if (alive) setError(e?.response?.data?.error || "Failed to load rooms"); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        title="Meeting Rooms"
        subtitle="Select a room to view its calendar and make a booking."
      />
      {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <Card key={r.id} className="p-5 hover:shadow-md transition" style={{ borderTop: "3px solid #74C69D" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "#D1FAE5" }}>
                <Building2 size={18} style={{ color: "#2D6A4F" }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{r.name}</div>
                <div className="mt-1 text-xs text-gray-500 leading-relaxed">{r.description}</div>
              </div>
            </div>
            <div className="mt-4">
              <Link to={`/rooms/${r.id}`}>
                <Button size="sm" className="w-full">Open Calendar</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
