import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client.js";
import { Badge, Button, Card, Input, SectionTitle, Select } from "../ui/components.jsx";
import {
  addDays,
  formatShort,
  formatWeekRange,
  minutesSinceMidnight,
  startOfWeek,
  toISODate,
} from "../utils/date.js";

function statusTone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "amber";
}

function timeOptions() {
  const opts = [];
  for (let h = 7; h <= 20; h++) {
    for (let m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push(`${hh}:${mm}:00`);
    }
  }
  return opts;
}

export default function RoomCalendar() {
  const { id } = useParams();
  const roomId = Number(id);

  const [rooms, setRooms] = useState([]);
  const [cal, setCal] = useState({ startDate: null, endDate: null, bookings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekStart, setWeekStart] = useState(() => toISODate(startOfWeek(new Date())));

  const [reqDate, setReqDate] = useState(() => toISODate(new Date()));
  const [startTime, setStartTime] = useState("09:00:00");
  const [endTime, setEndTime] = useState("10:00:00");
  const [meetingName, setMeetingName] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const room = useMemo(() => rooms.find((r) => Number(r.id) === roomId), [rooms, roomId]);
  const weekStartDate = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)), [weekStartDate]);
  const timeOpts = useMemo(() => timeOptions(), []);

  useEffect(() => {
    let alive = true;
    api.get("/api/rooms").then((r) => {
      if (!alive) return;
      setRooms(r.data.rooms || []);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get(`/api/calendar/room/${roomId}/week`, { params: { start: weekStart } })
      .then((r) => {
        if (!alive) return;
        setCal(r.data);
        setReqDate((prev) => {
          const start = r.data.startDate;
          if (!start) return prev;
          // Snap request date to current week range if outside
          if (prev < start || prev > r.data.endDate) return start;
          return prev;
        });
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.response?.data?.error || "Failed to load calendar");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [roomId, weekStart]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const b of cal.bookings || []) {
      const key = b.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    for (const v of map.values()) {
      v.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    }
    return map;
  }, [cal.bookings]);

  const clientConflictMessage = useMemo(() => {
    if (!reqDate || !startTime || !endTime) return "";
    const startM = minutesSinceMidnight(startTime);
    const endM = minutesSinceMidnight(endTime);
    if (!Number.isFinite(startM) || !Number.isFinite(endM)) return "";
    if (startM >= endM) return "Start time must be before end time.";

    const approved = byDate.get(reqDate) || [];
    for (const b of approved) {
      const bStart = minutesSinceMidnight(b.start_time);
      const bEnd = minutesSinceMidnight(b.end_time);
      const overlaps = !(bEnd <= startM || bStart >= endM);
      if (overlaps) {
        const s = String(b.start_time).slice(0, 5);
        const e = String(b.end_time).slice(0, 5);
        const who = b.user_full_name ? ` (${b.user_full_name})` : "";
        return `This room is already booked from ${s} to ${e}${who}. Please choose another time.`;
      }
    }
    return "";
  }, [byDate, endTime, reqDate, startTime]);

  async function submitRequest(e) {
    e.preventDefault();
    setSubmitError("");
    if (clientConflictMessage) {
      setSubmitError(clientConflictMessage);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/bookings", {
        roomId,
        date: reqDate,
        startTime,
        endTime,
        meetingName,
      });
      setMeetingName("");
      // refresh calendar
      const r = await api.get(`/api/calendar/room/${roomId}/week`, { params: { start: weekStart } });
      setCal(r.data);
    } catch (e2) {
      setSubmitError(e2?.response?.data?.error || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  const mobileDays = days.map((d) => ({ d, iso: toISODate(d) }));
  const [mobileTab, setMobileTab] = useState(() => toISODate(new Date()));
  useEffect(() => {
    // keep tab inside the visible week
    if (mobileTab < weekStart || mobileTab > toISODate(addDays(weekStartDate, 6))) {
      setMobileTab(weekStart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        title={room ? room.name : "Room calendar"}
        subtitle={room ? room.description : "Weekly calendar view of approved bookings"}
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="subtle"
              onClick={() => setWeekStart(toISODate(addDays(weekStartDate, -7)))}
            >
              Prev
            </Button>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              {formatWeekRange(weekStartDate)}
            </div>
            <Button
              variant="subtle"
              onClick={() => setWeekStart(toISODate(addDays(weekStartDate, 7)))}
            >
              Next
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-slate-900">Approved bookings</div>
            {loading ? <div className="text-xs text-slate-500">Loading...</div> : null}
          </div>

          <div className="mt-4 h-[520px] overflow-y-auto pr-1">
          {/* Desktop week grid */}
          <div className="hidden sm:grid grid-cols-7 gap-3">
            {days.map((d) => {
              const iso = toISODate(d);
              const items = byDate.get(iso) || [];
              return (
                <div key={iso} className="min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-slate-600">{formatShort(d)}</div>
                  <div className="mt-2 grid gap-2">
                    {items.length ? (
                      items.map((b) => (
                        <div
                          key={b.id}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 overflow-hidden break-words"
                        >
                          <div className="font-bold leading-snug break-words">{b.user_full_name}</div>
                          <div className="mt-0.5 text-blue-800">
                            {String(b.start_time).slice(0, 5)} – {String(b.end_time).slice(0, 5)}
                          </div>
                          {b.meeting_name ? (
                            <div className="mt-0.5 text-blue-800 break-words leading-snug">
                              {b.meeting_name}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
                        No bookings
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile day-by-day view */}
          <div className="sm:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {mobileDays.map(({ d, iso }) => (
                <button
                  key={iso}
                  className={[
                    "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition",
                    mobileTab === iso
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700",
                  ].join(" ")}
                  onClick={() => setMobileTab(iso)}
                >
                  {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d)}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-2">
              {(byDate.get(mobileTab) || []).length ? (
                (byDate.get(mobileTab) || []).map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm overflow-hidden break-words"
                  >
                    <div className="font-bold text-blue-900 leading-snug break-words">
                      {b.user_full_name}
                    </div>
                    <div className="text-xs text-blue-800">
                      {String(b.start_time).slice(0, 5)} – {String(b.end_time).slice(0, 5)}
                    </div>
                    {b.meeting_name ? (
                      <div className="mt-0.5 text-xs text-blue-800 break-words leading-snug">
                        {b.meeting_name}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                  No bookings
                </div>
              )}
            </div>
          </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-bold text-slate-900">Request a booking</div>
          <div className="mt-1 text-sm text-slate-600">
            Requests start as <Badge tone={statusTone("pending")}>Pending</Badge> and require admin approval.
          </div>

          <form className="mt-4 grid gap-3" onSubmit={submitRequest}>
            <Select label="Date" value={reqDate} onChange={(e) => setReqDate(e.target.value)}>
              {days.map((d) => {
                const iso = toISODate(d);
                return (
                  <option key={iso} value={iso}>
                    {formatShort(d)}
                  </option>
                );
              })}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Select label="Start time" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                {timeOpts.map((t) => (
                  <option key={t} value={t}>
                    {t.slice(0, 5)}
                  </option>
                ))}
              </Select>
              <Select label="End time" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                {timeOpts.map((t) => (
                  <option key={t} value={t}>
                    {t.slice(0, 5)}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Meeting name (optional)"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              placeholder="e.g. Weekly sync"
            />

            {clientConflictMessage && !submitError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {clientConflictMessage}
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            <Button disabled={submitting || Boolean(clientConflictMessage)} type="submit">
              {submitting ? "Submitting..." : "Submit request"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

