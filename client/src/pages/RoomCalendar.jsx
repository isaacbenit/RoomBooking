import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, X, Clock, CheckCircle2, ShieldCheck, Mail } from "lucide-react";
import api from "../api/client.js";
import { Alert, Button, Card, Input, SectionTitle } from "../ui/components.jsx";
import { addDays, formatWeekRange, startOfWeek, toISODate } from "../utils/date.js";
import { getApiErrorMessage } from "../utils/apiError.js";
import { useAuth } from "../state/auth.jsx";

const OPEN_MIN = 8 * 60;
const CLOSE_MIN = 18 * 60;
const STEP = 30;
const SLOT_INDICES = Array.from({ length: (CLOSE_MIN - OPEN_MIN) / STEP }, (_, i) => i);
const DAYS_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const FILTERS = [
  { key: "available", label: "Available", accent: "#1E293B" },
  { key: "selected", label: "Selected", accent: "#0284C7" },
  { key: "pending", label: "Pending Approval", accent: "#D97706" },
  { key: "myBooking", label: "My Booking", accent: "#059669" },
  { key: "booked", label: "Booked (Others)", accent: "#64748B" },
  { key: "inUse", label: "In Use Now", accent: "#0F172A" },
  { key: "past", label: "Past / Unavailable", accent: "#9CA3AF" },
];

function parseTimeToMinutes(t) {
  if (t == null) return 0;
  const parts = String(t).trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1] || "0", 10) || 0;
  return h * 60 + m;
}

function minutesToHHMM(m) {
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function minutesToApiTime(m) {
  return `${minutesToHHMM(m)}:00`;
}

function halfOpenOverlap(a0, a1, b0, b1) {
  return a0 < a1 && b0 < b1 && a0 < b1 && b0 < a1;
}

function rowTimes(iso, rowStartMins) {
  const s = minutesToHHMM(rowStartMins);
  const e = minutesToHHMM(rowStartMins + STEP);
  return {
    start: new Date(`${iso}T${s}:00`),
    end: new Date(`${iso}T${e}:00`),
  };
}

function isRowPast(iso, rowStartMins) {
  const { end } = rowTimes(iso, rowStartMins);
  return end <= new Date();
}

function bookingOverlapsRow(b, iso, rowStartMins) {
  if (b.date !== iso) return false;
  const bs = parseTimeToMinutes(b.start_time);
  const be = parseTimeToMinutes(b.end_time);
  return halfOpenOverlap(rowStartMins, rowStartMins + STEP, bs, be);
}

function findBookingForRow(bookings, iso, rowStartMins) {
  for (const b of bookings) {
    if (bookingOverlapsRow(b, iso, rowStartMins)) return b;
  }
  return null;
}

function selectionOverlapsRow(sel, iso, rowStartMins) {
  if (!sel || sel.date !== iso) return false;
  return halfOpenOverlap(rowStartMins, rowStartMins + STEP, sel.startMins, sel.endMins);
}

function slotCategory({ iso, rowStartMins, booking, userId, sel, now }) {
  if (isRowPast(iso, rowStartMins)) return "past";

  if (booking) {
    const isMe = Number(booking.user_id) === Number(userId);
    if (isMe) return "myBooking";
    if (booking.status === "pending") return "pending";

    const startDt = new Date(`${iso}T${minutesToHHMM(parseTimeToMinutes(booking.start_time))}:00`);
    const endDt = new Date(`${iso}T${minutesToHHMM(parseTimeToMinutes(booking.end_time))}:00`);
    if (now >= startDt && now < endDt) return "inUse";
    return "booked";
  }

  if (selectionOverlapsRow(sel, iso, rowStartMins)) return "selected";
  return "available";
}

function slotStyle(cat) {
  switch (cat) {
    case "past":
      return { bg: "#F3F4F6", color: "#9CA3AF", borderLeft: "none", border: "1px solid #E5E7EB", cursor: "default" };
    case "selected":
      return { bg: "#F0F9FF", color: "#0369A1", borderLeft: "3px solid #0284C7", border: "1px solid #BAE6FD", cursor: "pointer" };
    case "pending":
      return { bg: "#FEF3C7", color: "#92400E", borderLeft: "3px solid #D97706", border: "1px solid #FDE68A", cursor: "default" };
    case "booked":
      return { bg: "#F1F5F9", color: "#475569", borderLeft: "3px solid #64748B", border: "1px solid #E2E8F0", cursor: "default" };
    case "myBooking":
      return { bg: "#D1FAE5", color: "#065F46", borderLeft: "3px solid #059669", border: "1px solid #A7F3D0", cursor: "default" };
    case "inUse":
      return { bg: "#E2E8F0", color: "#0F172A", borderLeft: "3px solid #0F172A", border: "1px solid #CBD5E1", cursor: "default" };
    default:
      return { bg: "#FFFFFF", color: "#1E293B", borderLeft: "none", border: "1px solid #E5E7EB", cursor: "pointer" };
  }
}

function rangeHasBookingOrPast(bookings, iso, loIdx, hiIdx) {
  for (let i = loIdx; i <= hiIdx; i++) {
    const rs = OPEN_MIN + i * STEP;
    if (isRowPast(iso, rs)) return "past";
    const b = findBookingForRow(bookings, iso, rs);
    if (b && b.status === "confirmed") return "booked";
  }
  return null;
}

// Fixed variable name mismatch here: changed bookingsRef to bookings
function selectionConflictsBookings(bookings, sel) {
  if (!sel) return false;
  for (const b of bookings) {
    if (b.date !== sel.date || b.status !== "confirmed") continue;
    const bs = parseTimeToMinutes(b.start_time);
    const be = parseTimeToMinutes(b.end_time);
    if (halfOpenOverlap(sel.startMins, sel.endMins, bs, be)) return true;
  }
  return false;
}

function selectionStartsInPast(iso, startMins) {
  const today = toISODate(new Date());
  if (iso < today) return true;
  if (iso > today) return false;
  const startDt = new Date(`${iso}T${minutesToHHMM(startMins)}:00`);
  return startDt < new Date();
}

function validateSelection(bookings, sel) {
  if (!sel) return "Select a time range.";
  if (sel.startMins < OPEN_MIN || sel.endMins > CLOSE_MIN)
    return "Times must be between 08:00 and 18:00.";
  if (sel.startMins >= sel.endMins) return "End time must be after start time.";
  if (sel.endMins - sel.startMins < 30) return "Booking must be at least 30 minutes (for example 08:00–08:30).";
  if (selectionStartsInPast(sel.date, sel.startMins)) return "Selection cannot be in the past.";
  if (selectionConflictsBookings(bookings, sel)) return "Selection overlaps an existing booking.";
  return null;
}

export default function RoomCalendar() {
  const { id } = useParams();
  const roomId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => toISODate(startOfWeek(new Date())));
  const [selected, setSelected] = useState(null);
  const [meetingName, setMeetingName] = useState("");
  const [emailMessage, setEmailMessage] = useState(""); // NEW STATE FOR EMAIL TEXT
  const [submitError, setSubmitError] = useState("");
  const [mobileDay, setMobileDay] = useState(() => toISODate(new Date()));
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(FILTERS.map((f) => [f.key, true]))
  );

  const [drag, setDrag] = useState(null);
  const [mobileTap, setMobileTap] = useState(null);
  const [isCoarse, setIsCoarse] = useState(false);

  const weekStartDate = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStartDate, i)),
    [weekStartDate]
  );
  const [rooms, setRooms] = useState([]);

  const todayIso = toISODate(new Date());
  const now = new Date();

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    api.get("/api/rooms").then((r) => setRooms(r.data.rooms || [])).catch(() => {});
  }, []);

  const roomLive = useMemo(() => rooms.find((r) => Number(r.id) === roomId), [rooms, roomId]);

  const {
    data: bookings = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["roomCalendar", roomId, weekStart],
    queryFn: async () => {
      const r = await api.get(`/api/calendar/room/${roomId}/week`, { params: { start: weekStart } });
      return r.data.bookings || [];
    },
    enabled: Number.isFinite(roomId),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  });

  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;

  const error = queryError ? getApiErrorMessage(queryError, "Failed to load calendar.") : "";

  const bookMutation = useMutation({
    mutationFn: (payload) => api.post("/api/bookings", payload),
    onSuccess: async (axiosRes) => {
      const booking = axiosRes?.data?.booking;
      if (booking?.id) {
        queryClient.setQueryData(["roomCalendar", roomId, weekStart], (old) => {
          const arr = Array.isArray(old) ? [...old] : [];
          if (arr.some((b) => Number(b.id) === Number(booking.id))) return arr;
          const n = {
            ...booking,
            user_full_name: user?.full_name ?? booking.user_full_name ?? "You",
          };
          arr.push(n);
          return arr;
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["roomCalendar", roomId] });
      await queryClient.refetchQueries({
        queryKey: ["roomCalendar", roomId, weekStart],
        type: "active",
      });

      if (user?.role === "Admin") {
        toast.success("Room booked successfully!");
      } else {
        toast.success("Request sent! Admins have been notified via email.");
      }

      setSelected(null);
      setMeetingName("");
      setEmailMessage(""); // Clear message box
      setSubmitError("");
    },
    onError: (e) => {
      const status = e?.response?.status;
      if (status === 409) {
        setSubmitError("This time slot conflicts with a confirmed booking. Please choose another time.");
      } else {
        setSubmitError(getApiErrorMessage(e, "Could not save your booking. Please try again."));
      }
    },
  });

  const applyRangeSelection = useCallback((iso, idxA, idxB) => {
    setSubmitError("");
    const bList = bookingsRef.current;
    const lo = Math.min(idxA, idxB);
    const hi = Math.max(idxA, idxB);
    const block = rangeHasBookingOrPast(bList, iso, lo, hi);
    if (block) {
      setSubmitError(block === "past" ? "That range includes past times." : "That range includes an approved booking.");
      return;
    }
    const startMins = OPEN_MIN + lo * STEP;
    const endMins = OPEN_MIN + (hi + 1) * STEP;
    const sel = { date: iso, startMins, endMins };
    const err = validateSelection(bList, sel);
    if (err) {
      setSubmitError(err);
      return;
    }
    setSelected(sel);
  }, []);

  useEffect(() => {
    if (!drag) return;
    function endDrag() {
      setDrag((d) => {
        if (!d) return null;
        applyRangeSelection(d.iso, d.anchorIdx, d.currIdx);
        return null;
      });
    }
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    return () => {
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);
    };
  }, [drag, applyRangeSelection]);

  function onSlotPointerDown(iso, idx, cat) {
    if (isCoarse) return;
    if (cat !== "available") return;
    setSubmitError("");
    setDrag({ iso, anchorIdx: idx, currIdx: idx });
  }

  function onSlotPointerEnter(iso, idx) {
    if (!drag || drag.iso !== iso) return;
    const lo = Math.min(drag.anchorIdx, idx);
    const hi = Math.max(drag.anchorIdx, idx);
    for (let i = lo; i <= hi; i++) {
      const rs = OPEN_MIN + i * STEP;
      const b = findBookingForRow(bookings, iso, rs);
      if (isRowPast(iso, rs) || (b && b.status === "confirmed")) {
        return;
      }
    }
    setDrag((d) => (d && d.iso === iso ? { ...d, currIdx: idx } : d));
  }

  function onMobileCellClick(iso, idx, cat) {
    if (!isCoarse) return;
    if (cat !== "available") return;
    setSubmitError("");
    if (!mobileTap || mobileTap.iso !== iso) {
      setMobileTap({ iso, idx });
      return;
    }
    applyRangeSelection(iso, mobileTap.idx, idx);
    setMobileTap(null);
  }

  function toggleFilter(key) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  const startTimeInput = selected ? minutesToHHMM(selected.startMins) : "";
  const endTimeInput = selected ? minutesToHHMM(selected.endMins) : "";

  function applyTimeFromInputs(startStr, endStr) {
    if (!selected) return;
    const sm = parseTimeToMinutes(startStr);
    const em = parseTimeToMinutes(endStr);
    const sel = { ...selected, startMins: sm, endMins: em };
    const err = validateSelection(bookings, sel);
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError("");
    setSelected(sel);
  }

  function bookNow() {
    if (!selected) return;
    const err = validateSelection(bookings, selected);
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError("");
    bookMutation.mutate({
      roomId,
      date: selected.date,
      startTime: minutesToApiTime(selected.startMins),
      endTime: minutesToApiTime(selected.endMins),
      meetingName,
      emailMessage, // PASS MESSAGE VALUE TO BACKEND
    });
  }

  function SlotCell({ iso, idx }) {
    const rowStart = OPEN_MIN + idx * STEP;
    const booking = findBookingForRow(bookings, iso, rowStart);
    const cat = slotCategory({
      iso,
      rowStartMins: rowStart,
      booking,
      userId: user?.id,
      sel: selected,
      now,
    });
    const base = slotStyle(cat);
    const filterOn = filters[cat];
    const dim = !filterOn;
    const showHourLabel = rowStart % 60 === 0;

    const labelSecondary =
      cat === "booked" && booking ? (
        <span className="truncate block font-medium" style={{ fontSize: "0.62rem", opacity: 0.85 }}>
          Reserved
        </span>
      ) : cat === "myBooking" ? (
        <span className="truncate block font-semibold" style={{ fontSize: "0.62rem" }}>
          {booking?.status === "pending" ? "⏳ Pending My Req" : "✓ My Booking"}
        </span>
      ) : cat === "pending" ? (
        <span className="truncate block font-medium" style={{ fontSize: "0.62rem", opacity: 0.9 }}>
          ⏳ Pending Approvals
        </span>
      ) : cat === "inUse" ? (
        <span className="truncate block font-medium" style={{ fontSize: "0.62rem" }}>
          In use
        </span>
      ) : null;

    return (
      <div
        role="button"
        tabIndex={cat === "available" ? 0 : -1}
        onPointerDown={() => onSlotPointerDown(iso, idx, cat)}
        onPointerEnter={() => onSlotPointerEnter(iso, idx)}
        onClick={() => onMobileCellClick(iso, idx, cat)}
        title={
          booking
            ? `${booking.user_full_name} (${booking.status})${booking.meeting_name ? ` · ${booking.meeting_name}` : ""}`
            : `${minutesToHHMM(rowStart)} – ${minutesToHHMM(rowStart + STEP)}`
        }
        style={{
          background: base.bg,
          color: base.color,
          cursor: base.cursor,
          border: base.border,
          borderLeft: base.borderLeft || base.border,
          borderRadius: "4px",
          padding: "4px 6px",
          fontSize: "0.7rem",
          minHeight: "32px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transition: "opacity 0.15s, transform 0.1s",
          userSelect: "none",
          opacity: dim ? 0.22 : 1,
          pointerEvents: cat === "past" ? "none" : "auto",
        }}
      >
        {showHourLabel ? <div className="font-semibold opacity-75">{minutesToHHMM(rowStart)}</div> : <div style={{ height: "0.85rem" }} />}
        {labelSecondary}
      </div>
    );
  }

  const defaultPanelDate = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const isAdmin = user?.role === "Admin";

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 pb-8">
      <SectionTitle
        title={roomLive?.name ?? "Room Calendar"}
        subtitle={roomLive?.description ?? ""}
        right={
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <Button size="sm" variant="subtle" onClick={() => setWeekStart(toISODate(addDays(weekStartDate, -7)))}>
              <ChevronLeft size={14} />
            </Button>
            <span className="min-w-0 flex-1 text-center text-xs font-medium text-gray-600 sm:flex-none sm:px-1">
              {formatWeekRange(weekStartDate)}
            </span>
            <Button size="sm" variant="subtle" onClick={() => setWeekStart(toISODate(addDays(weekStartDate, 7)))}>
              <ChevronRight size={14} />
            </Button>
          </div>
        }
      />

      {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}

      <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label, accent }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleFilter(key)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                style={{
                  borderColor: filters[key] ? accent : "#E5E7EB",
                  background: filters[key] ? `${accent}12` : "#fff",
                  color: filters[key] ? "#0F172A" : "#9CA3AF",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-700">
                {loading ? "Loading..." : isCoarse ? "Tap start cell, then tap end cell" : "Click and drag across time ranges"}
              </div>
              {selected ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setSubmitError("");
                    setMobileTap(null);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X size={12} /> Clear
                </button>
              ) : null}
            </div>

            <div className="hidden sm:block overflow-x-auto overscroll-x-contain -mx-1 px-1">
              <div style={{ display: "grid", gridTemplateColumns: `54px repeat(5, minmax(80px, 1fr))`, gap: "6px", minWidth: "560px" }}>
                <div />
                {days.map((d, i) => {
                  const iso = toISODate(d);
                  return (
                    <div key={iso} className="text-center text-xs font-bold text-gray-500 pb-2">
                      <div className="uppercase tracking-wider text-gray-400 text-[10px]">{DAYS_LABEL[i]}</div>
                      <div className="text-sm mt-0.5" style={{ color: iso === todayIso ? "#059669" : "#334155" }}>{d.getDate()}</div>
                    </div>
                  );
                })}
                {SLOT_INDICES.map((idx) => (
                  <React.Fragment key={idx}>
                    <div className="text-right text-xs font-medium text-gray-400 pr-2 pt-1.5">
                      {(OPEN_MIN + idx * STEP) % 60 === 0 ? minutesToHHMM(OPEN_MIN + idx * STEP) : ""}
                    </div>
                    {days.map((d) => {
                      const iso = toISODate(d);
                      return <SlotCell key={`${iso}-${idx}`} iso={iso} idx={idx} />;
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="sm:hidden">
              <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
                {days.map((d, i) => {
                  const iso = toISODate(d);
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setMobileDay(iso)}
                      className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium border transition"
                      style={{
                        background: mobileDay === iso ? "#0F172A" : "#fff",
                        color: mobileDay === iso ? "#fff" : "#374151",
                        borderColor: mobileDay === iso ? "#0F172A" : "#E5E7EB",
                      }}
                    >
                      {DAYS_LABEL[i]} {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `48px 1fr` }}>
                {SLOT_INDICES.map((idx) => (
                  <React.Fragment key={idx}>
                    <div className="text-right text-xs font-medium text-gray-400 pr-2 pt-1.5">
                      {(OPEN_MIN + idx * STEP) % 60 === 0 ? minutesToHHMM(OPEN_MIN + idx * STEP) : ""}
                    </div>
                    <SlotCell iso={mobileDay} idx={idx} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card className="order-last p-4 lg:order-none lg:h-fit lg:sticky lg:top-[4.5rem]">
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <div className="text-sm font-bold text-gray-800">Reservation Details</div>
            {isAdmin ? (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                <ShieldCheck size={11} /> ADMIN INSTANT
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200">
                <Clock size={11} /> NEEDS APPROVAL
              </span>
            )}
          </div>

          <div className="rounded-lg p-3 text-sm mb-3 border transition-colors" style={{ background: selected ? (isAdmin ? "#F0FDF4" : "#FFFBEB") : "#F8FAFC", borderColor: selected ? (isAdmin ? "#BBF7D0" : "#FDE68A") : "#E2E8F0" }}>
            <div className="font-bold text-slate-800 text-base">{roomLive?.name ?? "Room"}</div>
            <div className="text-slate-600 font-medium mt-1">
              {selected ? new Date(selected.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : defaultPanelDate}
            </div>
            {selected ? (
              <>
                <div className="text-slate-900 font-bold text-md mt-1">{minutesToHHMM(selected.startMins)} – {minutesToHHMM(selected.endMins)}</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] font-bold text-slate-500 grid gap-1">
                    START TIME
                    <input type="time" className="rounded-md border border-gray-300 px-2 py-1 bg-white text-sm text-slate-700 font-medium" value={startTimeInput} onChange={(e) => applyTimeFromInputs(e.target.value, endTimeInput)} />
                  </label>
                  <label className="text-[11px] font-bold text-slate-500 grid gap-1">
                    END TIME
                    <input type="time" className="rounded-md border border-gray-300 px-2 py-1 bg-white text-sm text-slate-700 font-medium" value={endTimeInput} onChange={(e) => applyTimeFromInputs(startTimeInput, e.target.value)} />
                  </label>
                </div>
              </>
            ) : (
              <div className="text-gray-400 mt-2 text-xs italic">Select an available time slot grid block above to configure your window</div>
            )}
          </div>

          {selected ? (
            <>
              <Input
                label="Meeting context name (optional)"
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                placeholder="e.g. Project Sync Up"
              />

              {/* NEW OPTIONAL MESSAGE TEXT BOX FOR EMPLOYEES */}
              {!isAdmin && (
                <div className="mt-3 grid gap-1">
                  <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                    <Mail size={12} className="text-amber-500" /> Message to Admins (optional)
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-md border border-gray-300 p-2 text-xs text-gray-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    placeholder="Provide additional details or priority requests for the admins here..."
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="opacity-40 pointer-events-none grid gap-3">
              <Input label="Meeting context name" value="" placeholder="Select time windows first" disabled />
              {!isAdmin && (
                <div className="grid gap-1">
                  <label className="text-xs font-semibold text-gray-400">Message to Admins</label>
                  <textarea rows={2} className="w-full rounded-md border border-gray-200 p-2 text-xs bg-gray-50" placeholder="Select time windows first" disabled />
                </div>
              )}
            </div>
          )}

          {submitError ? <Alert variant="error" className="mt-3">{submitError}</Alert> : null}

          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={bookNow} disabled={!selected || bookMutation.isPending} className={`w-full text-xs font-bold uppercase tracking-wider ${isAdmin ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
              {bookMutation.isPending ? "Processing..." : isAdmin ? "Book Instantly" : "Submit Booking Request"}
            </Button>
            {selected ? (
              <Button variant="subtle" onClick={() => { setSelected(null); setSubmitError(""); setEmailMessage(""); setMobileTap(null); }} className="w-full text-xs text-slate-500">
                Cancel Selection
              </Button>
            ) : null}
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 grid gap-2 text-xs font-medium text-gray-500">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Color Palette Guide</div>
            {FILTERS.map(({ key, label }) => {
              const sample = slotStyle(key);
              return (
                <div key={label} className="flex items-center gap-2.5">
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: sample.bg, border: sample.border, borderLeft: sample.borderLeft || sample.border, flexShrink: 0 }} />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}