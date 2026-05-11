import React, { useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { Badge, Button, Card, SectionTitle } from "../ui/components.jsx";

function tone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "amber";
}

export default function MyRequests() {
  const [bookings, setBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [allHasMore, setAllHasMore] = useState(false);
  const [allOffset, setAllOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/bookings", { params: { limit: 50, offset: 0 } });
      const all = data.bookings || [];
      setBookings(all);
      const first = all.slice(0, 6);
      setAllBookings(first);
      setAllOffset(0);
      setAllHasMore(all.length > 6);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const pending = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings]
  );

  async function loadMoreAll() {
    const nextOffset = allOffset + 6;
    setBusyId("more-all");
    try {
      const next = bookings.slice(nextOffset, nextOffset + 6);
      setAllBookings((prev) => [...prev, ...next]);
      setAllOffset(nextOffset);
      setAllHasMore(nextOffset + 6 < bookings.length);
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id) {
    setBusyId(id);
    try {
      await api.patch(`/api/bookings/${id}/cancel`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to cancel request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        title="My Requests"
        subtitle="Track your booking requests and their statuses."
        right={
          <Button variant="subtle" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm font-bold text-slate-900">Pending</div>
          <div className="mt-4 max-h-[520px] overflow-y-auto pr-1 grid gap-3">
            {pending.length ? (
              pending.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {b.room_name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {b.date} · {String(b.start_time).slice(0, 5)} –{" "}
                        {String(b.end_time).slice(0, 5)}
                      </div>
                      {b.meeting_name ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {b.meeting_name}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge tone={tone(b.status)}>{b.status}</Badge>
                      <Button
                        variant="outline"
                        disabled={busyId === b.id}
                        onClick={() => cancel(b.id)}
                      >
                        {busyId === b.id ? "Cancelling..." : "Cancel"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No pending requests.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-bold text-slate-900">All</div>
          <div className="mt-4 max-h-[520px] overflow-y-auto pr-1 grid gap-3">
            {allBookings.length ? (
              allBookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {b.room_name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {b.date} · {String(b.start_time).slice(0, 5)} –{" "}
                        {String(b.end_time).slice(0, 5)}
                      </div>
                      {b.meeting_name ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {b.meeting_name}
                        </div>
                      ) : null}
                    </div>
                    <Badge tone={tone(b.status)}>{b.status}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No requests yet.
              </div>
            )}

            {allHasMore ? (
              <div className="pt-2">
                <Button
                  variant="outline"
                  disabled={busyId === "more-all"}
                  onClick={loadMoreAll}
                  className="w-full"
                >
                  {busyId === "more-all" ? "Loading..." : "See more"}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

