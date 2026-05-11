import React, { useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { Badge, Button, Card, Input, SectionTitle } from "../ui/components.jsx";

function tone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "amber";
}

export default function AdminDashboard() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingsHasMore, setBookingsHasMore] = useState(false);
  const [bookingsOffset, setBookingsOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomDesc, setEditRoomDesc] = useState("");
  const [editRoomError, setEditRoomError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [rRooms, rBookings] = await Promise.all([
        api.get("/api/rooms"),
        api.get("/api/bookings", { params: { limit: 5, offset: 0 } }),
      ]);
      setRooms(rRooms.data.rooms || []);
      setBookings(rBookings.data.bookings || []);
      setBookingsHasMore(Boolean(rBookings.data.hasMore));
      setBookingsOffset(0);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);
  async function loadMoreBookings() {
    const nextOffset = bookingsOffset + 5;
    setBusyId("bookings-more");
    setError("");
    try {
      const r = await api.get("/api/bookings", { params: { limit: 5, offset: nextOffset } });
      setBookings((prev) => [...prev, ...(r.data.bookings || [])]);
      setBookingsOffset(nextOffset);
      setBookingsHasMore(Boolean(r.data.hasMore));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load more bookings");
    } finally {
      setBusyId(null);
    }
  }

  const pending = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings]
  );

  async function approve(id) {
    setBusyId(id);
    setError("");
    try {
      await api.patch(`/api/bookings/${id}/approve`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to approve");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id) {
    setBusyId(id);
    setError("");
    try {
      await api.patch(`/api/bookings/${id}/reject`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to reject");
    } finally {
      setBusyId(null);
    }
  }

  async function createRoom(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.post("/api/rooms", { name: roomName, description: roomDesc });
      setRoomName("");
      setRoomDesc("");
      await refresh();
    } catch (e2) {
      setError(e2?.response?.data?.error || "Failed to create room");
    } finally {
      setCreating(false);
    }
  }

  async function deleteRoom(id) {
    const ok = window.confirm(
      "Delete this room? This will also delete all linked bookings."
    );
    if (!ok) return;
    setBusyId(`room:${id}`);
    setError("");
    try {
      await api.delete(`/api/rooms/${id}`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to delete room");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(room) {
    setEditingRoomId(room.id);
    setEditRoomName(room.name || "");
    setEditRoomDesc(room.description || "");
    setEditRoomError("");
  }

  function cancelEdit() {
    setEditingRoomId(null);
    setEditRoomName("");
    setEditRoomDesc("");
    setEditRoomError("");
  }

  async function saveEdit(id) {
    setBusyId(`room-edit:${id}`);
    setError("");
    setEditRoomError("");
    try {
      await api.patch(`/api/rooms/${id}`, { name: editRoomName, description: editRoomDesc });
      cancelEdit();
      await refresh();
    } catch (e) {
      const msg = e?.response?.data?.error || "Failed to update room";
      setEditRoomError(msg);
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        title="Admin Dashboard"
        subtitle="Approve requests, manage rooms, and view all bookings."
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm font-bold text-slate-900">Pending requests</div>
          <div className="mt-4 h-[520px] overflow-y-auto pr-1 grid gap-3">
            {pending.length ? (
              pending.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {b.room_name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {b.date} · {String(b.start_time).slice(0, 5)} –{" "}
                        {String(b.end_time).slice(0, 5)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Requested by <span className="font-semibold">{b.user_full_name}</span>
                      </div>
                      {b.meeting_name ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {b.meeting_name}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => approve(b.id)}
                      >
                        {busyId === b.id ? "..." : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId === b.id}
                        onClick={() => reject(b.id)}
                      >
                        Reject
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
          <div className="text-sm font-bold text-slate-900">Rooms</div>
          <form className="mt-4 grid gap-3" onSubmit={createRoom}>
            <Input
              label="Room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              required
            />
            <Input
              label="Description"
              value={roomDesc}
              onChange={(e) => setRoomDesc(e.target.value)}
              required
            />
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create room"}
            </Button>
          </form>

          <div className="mt-5 h-[420px] overflow-y-auto pr-1 grid gap-2">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  {editingRoomId === r.id ? (
                    <div className="grid gap-2">
                      <Input
                        label="Name"
                        value={editRoomName}
                        onChange={(e) => setEditRoomName(e.target.value)}
                      />
                      <Input
                        label="Description"
                        value={editRoomDesc}
                        onChange={(e) => setEditRoomDesc(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busyId === `room-edit:${r.id}`}
                          onClick={() => saveEdit(r.id)}
                        >
                          {busyId === `room-edit:${r.id}` ? "Saving..." : "Save"}
                        </Button>
                        <Button type="button" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                      {editRoomError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {editRoomError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div className="truncate text-sm font-extrabold text-slate-900">{r.name}</div>
                      <div className="mt-1 text-xs text-slate-600 break-words">{r.description}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => startEdit(r)}>
                          Edit
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                {editingRoomId === r.id ? null : (
                  <Button
                    type="button"
                    variant="danger"
                    className="shrink-0"
                    disabled={busyId === `room:${r.id}`}
                    onClick={() => deleteRoom(r.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900">All bookings</div>
            <div className="mt-1 text-sm text-slate-600">
              Across all rooms and users.
            </div>
          </div>
          {loading ? <div className="text-xs text-slate-500">Loading...</div> : null}
        </div>

        <div className="mt-4 h-[520px] overflow-y-auto pr-1 grid gap-2">
          {bookings.length ? (
            bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-slate-900">
                      {b.room_name} · {b.date}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {String(b.start_time).slice(0, 5)} – {String(b.end_time).slice(0, 5)} ·{" "}
                      <span className="font-semibold">{b.user_full_name}</span>
                      {b.meeting_name ? ` · ${b.meeting_name}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Badge tone={tone(b.status)}>{b.status}</Badge>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              No bookings yet.
            </div>
          )}

          {bookingsHasMore ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={busyId === "bookings-more"}
                onClick={loadMoreBookings}
                className="w-full"
              >
                {busyId === "bookings-more" ? "Loading..." : "See more"}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

