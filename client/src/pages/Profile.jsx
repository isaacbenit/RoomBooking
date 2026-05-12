import React, { useEffect, useRef, useState } from "react";
import api from "../api/client.js";
import { useAuth } from "../state/auth.jsx";
import { Badge, Button, Card, Input, SectionTitle } from "../ui/components.jsx";

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function SuccessMsg({ msg }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {msg}
    </div>
  );
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {msg}
    </div>
  );
}

// Auto-clear a success message after 3 seconds
function useAutoSuccess() {
  const [msg, setMsg] = useState("");
  const timer = useRef(null);
  function show(text) {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 3000);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  return [msg, show];
}

export default function Profile() {
  const { user, updateUser } = useAuth();

  // ── Personal info ──
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [nameError, setNameError] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, showNameSuccess] = useAutoSuccess();

  // ── Password ──
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, showPwSuccess] = useAutoSuccess();

  async function saveName(e) {
    e.preventDefault();
    setNameError("");
    if (fullName.trim().length < 2) {
      setNameError("Full name must be at least 2 characters.");
      return;
    }
    setNameSaving(true);
    try {
      const { data } = await api.patch("/api/users/me/name", { fullName });
      updateUser(data.user);
      showNameSuccess("Your name has been updated successfully.");
    } catch (err) {
      setNameError(err?.response?.data?.error || "Failed to update name.");
    } finally {
      setNameSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError("");
    if (!currentPw) { setPwError("Current password is required."); return; }
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    if (newPw === currentPw) { setPwError("New password cannot be the same as your current password."); return; }
    setPwSaving(true);
    try {
      await api.patch("/api/users/me/password", { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      showPwSuccess("Your password has been updated successfully.");
    } catch (err) {
      setPwError(err?.response?.data?.error || "Failed to update password.");
    } finally {
      setPwSaving(false);
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SectionTitle title="My Profile" subtitle="Manage your personal information and password." />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ── Personal Information ── */}
        <Card className="p-6">
          <div className="text-sm font-bold text-slate-900 mb-5">Personal Information</div>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xl font-extrabold select-none">
              {initials(user?.full_name)}
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">{user?.full_name}</div>
              <div className="text-sm text-slate-500">{user?.email}</div>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={saveName}>
            {/* Full name — editable */}
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />

            {/* Email — read only */}
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Email</div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {user?.email}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Email cannot be changed. Contact your administrator if needed.
              </div>
            </div>

            {/* Role */}
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Role</div>
              <div className="flex items-center gap-2">
                <Badge tone={user?.role === "Admin" ? "amber" : "blue"}>{user?.role}</Badge>
              </div>
            </div>

            {/* Member since */}
            {memberSince ? (
              <div>
                <div className="mb-1 text-sm font-medium text-slate-700">Member since</div>
                <div className="text-sm text-slate-600">{memberSince}</div>
              </div>
            ) : null}

            <ErrorMsg msg={nameError} />
            <SuccessMsg msg={nameSuccess} />

            <Button type="submit" disabled={nameSaving}>
              {nameSaving ? "Saving..." : "Update Name"}
            </Button>
          </form>
        </Card>

        {/* ── Change Password ── */}
        <Card className="p-6">
          <div className="text-sm font-bold text-slate-900 mb-5">Change Password</div>

          <form className="grid gap-4" onSubmit={savePassword}>
            <Input
              label="Current password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Input
              label="New password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              required
            />

            <ErrorMsg msg={pwError} />
            <SuccessMsg msg={pwSuccess} />

            <Button type="submit" disabled={pwSaving}>
              {pwSaving ? "Saving..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
