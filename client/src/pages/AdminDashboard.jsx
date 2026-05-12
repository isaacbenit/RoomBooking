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

  const [regStatus, setRegStatus] = useState("pending");
  const [regRequests, setRegRequests] = useState([]);
  const [regTempPassword, setRegTempPassword] = useState(null);

  const [users, setUsers] = useState([]);
  const [adminCap, setAdminCap] = useState(5);
  const [firstAdminEmail, setFirstAdminEmail] = useState("isaac.benit@testsolutions.de");
  const [userQuery, setUserQuery] = useState("");
  const [usersVisible, setUsersVisible] = useState(5);
  const [open, setOpen] = useState({
    bookingsPending: true,
    rooms: false,
    regRequests: false,
    manageUsers: false,
    allBookings: false,
  });

  function ToggleHeader({ title, subtitle, sectionKey }) {
    const isOpen = Boolean(open[sectionKey]);
    return (
      <button
        type="button"
        onClick={() => setOpen((prev) => ({ ...prev, [sectionKey]: !isOpen }))}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
          </div>
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            {isOpen ? "Hide" : "Show"}
          </div>
        </div>
      </button>
    );
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [rRooms, rBookings, rReqs, rUsers] = await Promise.all([
        api.get("/api/rooms"),
        api.get("/api/bookings", { params: { limit: 5, offset: 0 } }),
        api.get("/api/admin/registration-requests", { params: { status: regStatus } }),
        api.get("/api/admin/users"),
      ]);
      setRooms(rRooms.data.rooms || []);
      setBookings(rBookings.data.bookings || []);
      setBookingsHasMore(Boolean(rBookings.data.hasMore));
      setBookingsOffset(0);
      setRegRequests(rReqs.data.requests || []);
      setUsers(rUsers.data.users || []);
      setUsersVisible(5);
      setAdminCap(rUsers.data.adminCap || 5);
      setFirstAdminEmail(rUsers.data.firstAdminEmail || "isaac.benit@testsolutions.de");
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regStatus]);
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

  async function refreshRegistrationRequests(status = regStatus) {
    setBusyId("reg-refresh");
    setError("");
    try {
      const r = await api.get("/api/admin/registration-requests", { params: { status } });
      setRegRequests(r.data.requests || []);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load registration requests");
    } finally {
      setBusyId(null);
    }
  }

  async function approveRequest(id) {
    setBusyId(`reg-approve:${id}`);
    setError("");
    setRegTempPassword(null);
    try {
      const r = await api.patch(`/api/admin/registration-requests/${id}/approve`);
      setRegTempPassword(r.data.temporaryPassword || null);
      await refreshRegistrationRequests("pending");
      setRegStatus("pending");
      const u = await api.get("/api/admin/users");
      setUsers(u.data.users || []);
      setUsersVisible(5);
      setAdminCap(u.data.adminCap || 5);
      setFirstAdminEmail(u.data.firstAdminEmail || firstAdminEmail);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to approve request");
    } finally {
      setBusyId(null);
    }
  }

  async function rejectRequest(id) {
    setBusyId(`reg-reject:${id}`);
    setError("");
    try {
      await api.patch(`/api/admin/registration-requests/${id}/reject`);
      await refreshRegistrationRequests(regStatus);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to reject request");
    } finally {
      setBusyId(null);
    }
  }

  const adminCountLive = useMemo(
    () => users.filter((u) => u.role === "Admin").length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = String(u.full_name || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [userQuery, users]);

  useEffect(() => {
    setUsersVisible(5);
  }, [userQuery]);

  async function setUserRole(userId, role) {
    setBusyId(`user-role:${userId}`);
    setError("");
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      const u = await api.get("/api/admin/users");
      setUsers(u.data.users || []);
      setAdminCap(u.data.adminCap || 5);
      setFirstAdminEmail(u.data.firstAdminEmail || firstAdminEmail);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to update role");
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
          <ToggleHeader
            title="Pending booking requests"
            subtitle="Approve or reject booking requests."
            sectionKey="bookingsPending"
          />
          {open.bookingsPending ? (
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
          ) : null}
        </Card>

        <Card className="p-5">
          <ToggleHeader
            title="Rooms"
            subtitle="Create, edit, or delete rooms."
            sectionKey="rooms"
          />
          {open.rooms ? (
          <>
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
          </>
          ) : null}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <ToggleHeader
            title="Registration Requests"
            subtitle="Approve requests to create Employee accounts and share a temporary password."
            sectionKey="regRequests"
          />
          {open.regRequests ? (
          <>
          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              variant={regStatus === "pending" ? "primary" : "outline"}
              onClick={() => setRegStatus("pending")}
            >
              Pending
            </Button>
            <Button
              type="button"
              variant={regStatus === "rejected" ? "primary" : "outline"}
              onClick={() => setRegStatus("rejected")}
            >
              Rejected
            </Button>
          </div>

          {regTempPassword ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm font-extrabold text-emerald-900">Temporary password</div>
              <div className="mt-2 rounded-xl bg-white px-3 py-2 font-mono text-sm text-emerald-900 border border-emerald-200">
                {regTempPassword}
              </div>
              <div className="mt-2 text-xs text-emerald-800">
                Share this password with the employee. They can log in immediately.
              </div>
            </div>
          ) : null}

          <div className="mt-4 h-[520px] overflow-y-auto pr-1 grid gap-3">
            {regRequests.length ? (
              regRequests.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">
                        {r.full_name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600 break-words">{r.email}</div>
                      {r.reason ? (
                        <div className="mt-1 text-xs text-slate-500 break-words">{r.reason}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-slate-500">
                        Submitted: {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    {regStatus === "pending" ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          disabled={busyId === `reg-approve:${r.id}`}
                          onClick={() => approveRequest(r.id)}
                        >
                          {busyId === `reg-approve:${r.id}` ? "..." : "Approve"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busyId === `reg-reject:${r.id}`}
                          onClick={() => rejectRequest(r.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Badge tone="red">rejected</Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No {regStatus} requests.
              </div>
            )}
          </div>
          </>
          ) : null}
        </Card>

        <Card className="p-5">
          <ToggleHeader
            title="Manage Users"
            subtitle={`Promote or demote users. Admin limit is ${adminCap} (currently ${adminCountLive}/${adminCap}).`}
            sectionKey="manageUsers"
          />
          {open.manageUsers ? (
          <>

          {adminCountLive >= adminCap ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Admin limit reached (5/5). Demote an existing admin first before promoting a new one.
            </div>
          ) : null}

          <div className="mt-4">
            <Input
              label="Search users"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search by name or email..."
            />
          </div>

          <div className="mt-4 h-[520px] overflow-y-auto pr-1 grid gap-2">
            {filteredUsers.slice(0, usersVisible).map((u) => (
              <div
                key={u.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-slate-900">
                      {u.full_name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 break-words">{u.email}</div>
                    <div className="mt-2">
                      <Badge tone={u.role === "Admin" ? "amber" : "blue"}>{u.role}</Badge>
                      {String(u.email).toLowerCase() === firstAdminEmail ? (
                        <span className="ml-2 text-xs text-slate-500">(seeded)</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {u.role === "Employee" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId === `user-role:${u.id}` || adminCountLive >= adminCap}
                        onClick={() => setUserRole(u.id, "Admin")}
                      >
                        Promote to Admin
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId === `user-role:${u.id}`}
                        onClick={() => setUserRole(u.id, "Employee")}
                      >
                        Demote to Employee
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No users match your search.
              </div>
            ) : null}

            {filteredUsers.length > usersVisible ? (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setUsersVisible((v) => v + 5)}
                >
                  See more
                </Button>
              </div>
            ) : null}
          </div>
          </>
          ) : null}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <ToggleHeader
          title="All bookings"
          subtitle="Across all rooms and users."
          sectionKey="allBookings"
        />
        {open.allBookings ? (

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
        ) : null}
      </Card>
    </div>
  );
}

