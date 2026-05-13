import React, { useEffect, useState } from "react";
import { CalendarDays, XCircle } from "lucide-react";
import api from "../api/client.js";
import { Alert, Badge, Button, Card, SectionTitle } from "../ui/components.jsx";

function statusTone(status) {
  if (status === "confirmed") return "green";
  if (status === "cancelled") return "red";
  return "slate";
}

export default function MyRequests() {
  const [bookings, setBookings] = useState([]);
  const [visible, setVisible] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/bookings", { params: { limit: 50, offset: 0 } });
      setBookings(data.bookings || []);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function cancel(id) {
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await api.patch(`/api/bookings/${id}/cancel`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to cancel booking");
    } finally {
      setBusyId(null);
    }
  }

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(`${b.date}T${b.end_time}`) >= now);
  const past = bookings.filter((b) => new Date(`${b.date}T${b.end_time}`) < now);

  function BookingCard({ b, showCancel }) {
    const endDt = new Date(`${b.date}T${b.end_time}`);
    const canCancel = showCancel && endDt >= now;
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "#D1FAE5" }}>
              <CalendarDays size={15} style={{ color: "#2D6A4F" }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{b.room_name}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {b.date} · {String(b.start_time).slice(0, 5)} – {String(b.end_time).slice(0, 5)}
              </div>
              {b.meeting_name ? (
                <div className="mt-0.5 text-xs text-gray-400">{b.meeting_name}</div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge tone={statusTone(b.status)}>{b.status}</Badge>
            {canCancel ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === b.id}
                onClick={() => cancel(b.id)}
                className="flex items-center gap-1"
              >
                <XCircle size={12} />
                {busyId === b.id ? "..." : "Cancel"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SectionTitle
        title="My Bookings"
        subtitle="Your confirmed and past room bookings."
        right={
          <Button size="sm" variant="subtle" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-800 mb-3">Upcoming</div>
          <div className="grid gap-2 max-h-[520px] overflow-y-auto pr-1">
            {upcoming.length ? (
              upcoming.map((b) => <BookingCard key={b.id} b={b} showCancel />)
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-400">
                No upcoming bookings.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-800 mb-3">Past</div>
          <div className="grid gap-2 max-h-[520px] overflow-y-auto pr-1">
            {past.slice(0, visible).length ? (
              past.slice(0, visible).map((b) => <BookingCard key={b.id} b={b} showCancel={false} />)
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-400">
                No past bookings.
              </div>
            )}
            {past.length > visible ? (
              <Button size="sm" variant="subtle" className="w-full mt-1" onClick={() => setVisible((v) => v + 10)}>
                See more
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
