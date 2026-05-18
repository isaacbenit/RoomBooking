import React, { useEffect, useMemo, useState } from "react";
import { Building2, ClipboardList, Settings, Trash2, Pencil, Plus, Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import api from "../api/client.js";
import { useAuth } from "../state/auth.jsx";
import { Alert, Badge, Button, Card, Input, SectionTitle } from "../ui/components.jsx";

function statusTone(status) {
  if (status === "confirmed") return "green";
  if (status === "rejected" || status === "cancelled") return "red";
  return "amber"; // "pending" falls here
}

function regTone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "amber";
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();

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

  const [users, setUsers] = useState([]);
  const [adminCap, setAdminCap] = useState(5);
  const [firstAdminEmail, setFirstAdminEmail] = useState("isaac.benit@testsolutions.de");
  const [userQuery, setUserQuery] = useState("");
  const [usersVisible, setUsersVisible] = useState(5);

  const [open, setOpen] = useState({
    bookings: true, rooms: false, regRequests: false, manageUsers: false,
  });

  function toggle(key) { setOpen((p) => ({ ...p, [key]: !p[key] })); }

  function Section({ sectionKey, icon: Icon, title, subtitle, children }) {
    const isOpen = open[sectionKey];
    return (
      <Card className="p-4">
        <button type="button" onClick={() => toggle(sectionKey)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Icon size={16} style={{ color: "#2D6A4F", marginTop: 2 }} />
              <div>
                <div className="text-sm font-semibold text-gray-900">{title}</div>
                {subtitle ? <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div> : null}
              </div>
            </div>
            <span className="text-xs font-medium text-gray-500 shrink-0">{isOpen ? "Hide" : "Show"}</span>
          </div>
        </button>
        {isOpen ? <div className="mt-4">{children}</div> : null}
      </Card>
    );
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [rRooms, rBookings, rReqs, rUsers] = await Promise.all([
        api.get("/api/rooms"),
        api.get("/api/bookings", { params: { limit: 10, offset: 0 } }),
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
      setFirstAdminEmail(rUsers.data.firstAdminEmail || firstAdminEmail);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [regStatus]);

  async function loadMoreBookings() {
    const nextOffset = bookingsOffset + 10;
    setBusyId("bookings-more");
    try {
      const r = await api.get("/api/bookings", { params: { limit: 10, offset: nextOffset } });
      setBookings((prev) => [...prev, ...(r.data.bookings || [])]);
      setBookingsOffset(nextOffset);
      setBookingsHasMore(Boolean(r.data.hasMore));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load more");
    } finally {
      setBusyId(null);
    }
  }

  // NEW FEATURE: Admin can change room booking statuses directly
  async function updateBookingStatus(id, newStatus) {
    setBusyId(`status:${id}`);
    setError("");
    try {
      await api.patch(`/api/bookings/${id}/status`, { status: newStatus });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to update booking status");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelBooking(id) {
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return;
    setBusyId(`cancel:${id}`);
    try {
      await api.patch(`/api/bookings/${id}/cancel`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to cancel booking");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteBooking(id) {
    if (!window.confirm("Permanently delete this booking?")) return;
    setBusyId(`del:${id}`);
    try {
      await api.delete(`/api/bookings/${id}`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to delete booking");
    } finally {
      setBusyId(null);
    }
  }

  async function approveRequest(id) {
    setBusyId(`reg-approve:${id}`);
    try {
      await api.patch(`/api/admin/registration-requests/${id}/approve`);
      const [rReqs, rUsers] = await Promise.all([
        api.get("/api/admin/registration-requests", { params: { status: "pending" } }),
        api.get("/api/admin/users"),
      ]);
      setRegRequests(rReqs.data.requests || []);
      setRegStatus("pending");
      setUsers(rUsers.data.users || []);
      setUsersVisible(5);
      setAdminCap(rUsers.data.adminCap || 5);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to approve request");
    } finally {
      setBusyId(null);
    }
  }

  async function rejectRequest(id) {
    setBusyId(`reg-reject:${id}`);
    try {
      await api.patch(`/api/admin/registration-requests/${id}/reject`);
      const r = await api.get("/api/admin/registration-requests", { params: { status: regStatus } });
      setRegRequests(r.data.requests || []);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to reject request");
    } finally {
      setBusyId(null);
    }
  }

  const adminCountLive = useMemo(() => users.filter((u) => u.role === "Admin").length, [users]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      String(u.full_name || "").toLowerCase().includes(q) ||
      String(u.email || "").toLowerCase().includes(q)
    );
  }, [userQuery, users]);

  useEffect(() => { setUsersVisible(5); }, [userQuery]);

  async function setUserRole(userId, role) {
    setBusyId(`role:${userId}`);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      const u = await api.get("/api/admin/users");
      setUsers(u.data.users || []);
      setAdminCap(u.data.adminCap || 5);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to update role");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(u) {
    if (!window.confirm(`Delete ${u.full_name}? This cannot be undone.`)) return;
    setBusyId(`user-del:${u.id}`);
    try {
      await api.delete(`/api/admin/users/${u.id}`);
      const res = await api.get("/api/admin/users");
      setUsers(res.data.users || []);
      setAdminCap(res.data.adminCap || 5);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to delete user");
    } finally {
      setBusyId(null);
    }
  }

  async function createRoom(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/api/rooms", { name: roomName, description: roomDesc });
      setRoomName(""); setRoomDesc("");
      await refresh();
    } catch (e2) {
      setError(e2?.response?.data?.error || "Failed to create room");
    } finally {
      setCreating(false);
    }
  }

  async function deleteRoom(id) {
    if (!window.confirm("Delete this room? All linked bookings will also be deleted.")) return;
    setBusyId(`room:${id}`);
    try {
      await api.delete(`/api/rooms/${id}`);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to delete room");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(r) { setEditingRoomId(r.id); setEditRoomName(r.name); setEditRoomDesc(r.description); setEditRoomError(""); }
  function cancelEdit() { setEditingRoomId(null); setEditRoomName(""); setEditRoomDesc(""); setEditRoomError(""); }

  async function saveEdit(id) {
    setBusyId(`room-edit:${id}`);
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

  function canDeleteUser(u) {
    return String(u.email).toLowerCase() !== firstAdminEmail && Number(u.id) !== Number(currentUser?.id);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        title="Admin Dashboard"
        subtitle="Manage rooms, bookings, and users."
        right={<Button size="sm" variant="subtle" onClick={refresh} disabled={loading}>Refresh</Button>}
      />

      {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* All Bookings */}
        <Section sectionKey="bookings" icon={ClipboardList} title="All Bookings" subtitle="Approve, reject, or delete reservations.">
          <div className="grid gap-2 max-h-[480px] overflow-y-auto pr-1">
            {bookings.length ? bookings.map((b) => (
              <div key={b.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{b.room_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {b.date} · {String(b.start_time).slice(0, 5)} – {String(b.end_time).slice(0, 5)}
                    </div>
                    <div className="text-xs text-gray-400">{b.user_full_name}{b.meeting_name ? ` · ${b.meeting_name}` : ""}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                    <div className="flex gap-1 mt-1">
                      {/* Interactive Controls for Pending Bookings */}
                      {b.status === "pending" ? (
                        <>
                          <Button size="sm" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white" disabled={!!busyId} onClick={() => updateBookingStatus(b.id, "confirmed")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200" disabled={!!busyId} onClick={() => updateBookingStatus(b.id, "rejected")}>
                            Reject
                          </Button>
                        </>
                      ) : (
                        /* Standard Controls for Confirmed/Processed Bookings */
                        b.status === "confirmed" && (
                          <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => cancelBooking(b.id)}>
                            <XCircle size={11} /> Cancel
                          </Button>
                        )
                      )}
                      <Button size="sm" variant="danger" disabled={!!busyId} onClick={() => deleteBooking(b.id)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-400">No bookings yet.</div>
            )}
            {bookingsHasMore ? (
              <Button size="sm" variant="subtle" className="w-full mt-1" disabled={busyId === "bookings-more"} onClick={loadMoreBookings}>
                {busyId === "bookings-more" ? "Loading..." : "See more"}
              </Button>
            ) : null}
          </div>
        </Section>

        {/* Rooms */}
        <Section sectionKey="rooms" icon={Building2} title="Rooms" subtitle="Create, edit, or delete rooms.">
          <form className="grid gap-2 mb-4" onSubmit={createRoom}>
            <Input label="Room name" value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
            <Input label="Description" value={roomDesc} onChange={(e) => setRoomDesc(e.target.value)} required />
            <Button type="submit" size="sm" disabled={creating} className="flex items-center gap-1">
              <Plus size={13} />{creating ? "Creating..." : "Create room"}
            </Button>
          </form>
          <div className="grid gap-2 max-h-[360px] overflow-y-auto pr-1">
            {rooms.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-3">
                {editingRoomId === r.id ? (
                  <div className="grid gap-2">
                    <Input label="Name" value={editRoomName} onChange={(e) => setEditRoomName(e.target.value)} />
                    <Input label="Description" value={editRoomDesc} onChange={(e) => setEditRoomDesc(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busyId === `room-edit:${r.id}`} onClick={() => saveEdit(r.id)}>
                        {busyId === `room-edit:${r.id}` ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="subtle" onClick={cancelEdit}>Cancel</Button>
                    </div>
                    {editRoomError ? <Alert variant="error">{editRoomError}</Alert> : null}
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{r.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5 break-words">{r.description}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}><Pencil size={11} /></Button>
                      <Button size="sm" variant="danger" disabled={busyId === `room:${r.id}`} onClick={() => deleteRoom(r.id)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Registration Requests */}
        <Section sectionKey="regRequests" icon={Clock} title="Registration Requests" subtitle="Approve or reject access requests.">
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant={regStatus === "pending" ? "primary" : "outline"} onClick={() => setRegStatus("pending")}>Pending</Button>
            <Button size="sm" variant={regStatus === "rejected" ? "primary" : "outline"} onClick={() => setRegStatus("rejected")}>Rejected</Button>
          </div>
          <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
            {regRequests.length ? regRequests.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{r.full_name}</div>
                    <div className="text-xs text-gray-500 break-words">{r.email}</div>
                    {r.reason ? <div className="text-xs text-gray-400 mt-0.5">{r.reason}</div> : null}
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  {regStatus === "pending" ? (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" disabled={busyId === `reg-approve:${r.id}`} onClick={() => approveRequest(r.id)}>
                        <CheckCircle2 size={11} />{busyId === `reg-approve:${r.id}` ? "..." : "Approve"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === `reg-reject:${r.id}`} onClick={() => rejectRequest(r.id)}>
                        <XCircle size={11} />
                      </Button>
                    </div>
                  ) : <Badge tone="red">rejected</Badge>}
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">No {regStatus} requests.</div>
            )}
          </div>
        </Section>

        {/* Manage Users */}
        <Section sectionKey="manageUsers" icon={Users} title="Manage Users" subtitle={`Admin limit: ${adminCountLive}/${adminCap}`}>
          {adminCountLive >= adminCap ? (
            <Alert variant="warning" className="mb-3">Admin limit reached (5/5). Demote an existing admin first.</Alert>
          ) : null}
          <Input
            label="Search"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Name or email..."
          />
          <div className="mt-3 grid gap-2 max-h-[400px] overflow-y-auto pr-1">
            {filteredUsers.slice(0, usersVisible).map((u) => (
              <div key={u.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{u.full_name}</div>
                    <div className="text-xs text-gray-500 break-words">{u.email}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone={u.role === "Admin" ? "amber" : "slate"}>{u.role}</Badge>
                      {String(u.email).toLowerCase() === firstAdminEmail ? (
                        <span className="text-xs text-gray-400">(primary)</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                    {u.role === "Employee" ? (
                      <Button size="sm" variant="outline" disabled={busyId === `role:${u.id}` || adminCountLive >= adminCap} onClick={() => setUserRole(u.id, "Admin")}>
                        Promote
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busyId === `role:${u.id}`} onClick={() => setUserRole(u.id, "Employee")}>
                        Demote
                      </Button>
                    )}
                    {canDeleteUser(u) ? (
                      <Button size="sm" variant="danger" disabled={busyId === `user-del:${u.id}`} onClick={() => deleteUser(u)}>
                        <Trash2 size={11} />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-4">No users match.</div>
            ) : null}
            {filteredUsers.length > usersVisible ? (
              <Button size="sm" variant="subtle" className="w-full" onClick={() => setUsersVisible((v) => v + 5)}>See more</Button>
            ) : null}
          </div>
        </Section>
      </div>
    </div>
  );
}