import React, { useEffect, useRef, useState } from "react";
import { KeyRound, Lock, UserCircle } from "lucide-react";
import api from "../api/client.js";
import { useAuth } from "../state/auth.jsx";
import { Alert, Badge, Button, Card, Input, SectionTitle } from "../ui/components.jsx";

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0].toUpperCase()).slice(0, 2).join("");
}

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

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [nameError, setNameError] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, showNameSuccess] = useAutoSuccess();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, showPwSuccess] = useAutoSuccess();

  async function saveName(e) {
    e.preventDefault();
    setNameError("");
    if (fullName.trim().length < 2) { setNameError("Full name must be at least 2 characters."); return; }
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

  // Frontend Validations
  if (!currentPw) { setPwError("Current password is required."); return; }
  if (newPw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
  if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
  if (newPw === currentPw) { setPwError("New password cannot be the same as your current password."); return; }

  setPwSaving(true);
  try {
    // Make sure the key names here match your backend (currentPassword vs currentPw)
    await api.patch("/api/users/me/password", {
      currentPassword: currentPw,
      newPassword: newPw
    });

    // Success: Clear fields and show message
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    showPwSuccess("Your password has been updated successfully.");
  } catch (err) {
    // If backend sends { error: "..." }, this catches it.
    // If it's a 401, err.response.status will be 401.
    const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to update password.";
    setPwError(errorMessage);
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
        {/* Personal info */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCircle size={16} style={{ color: "#2D6A4F" }} />
            <span className="text-sm font-semibold text-gray-800">Personal Information</span>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white text-lg font-semibold select-none"
              style={{ background: "#2D6A4F" }}
            >
              {initials(user?.full_name)}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{user?.full_name}</div>
              <div className="text-xs text-gray-500">{user?.email}</div>
            </div>
          </div>

          <form className="grid gap-3" onSubmit={saveName}>
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />

            <div>
              <div className="mb-1 text-xs font-medium text-gray-600" style={{ letterSpacing: "0.02em" }}>Email</div>
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                <Lock size={13} className="text-gray-400 shrink-0" />
                {user?.email}
              </div>
              <div className="mt-1 text-xs text-gray-400">Email cannot be changed. Contact your administrator if needed.</div>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-gray-600">Role</div>
              <Badge tone={user?.role === "Admin" ? "amber" : "slate"}>{user?.role}</Badge>
            </div>

            {memberSince ? (
              <div>
                <div className="mb-1 text-xs font-medium text-gray-600">Member since</div>
                <div className="text-sm text-gray-600">{memberSince}</div>
              </div>
            ) : null}

            {nameError ? <Alert variant="error">{nameError}</Alert> : null}
            {nameSuccess ? <Alert variant="success">{nameSuccess}</Alert> : null}

            <Button type="submit" disabled={nameSaving} className="w-full">
              {nameSaving ? "Saving..." : "Update Name"}
            </Button>
          </form>
        </Card>

        {/* Change password */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={16} style={{ color: "#2D6A4F" }} />
            <span className="text-sm font-semibold text-gray-800">Change Password</span>
          </div>

          <form className="grid gap-3" onSubmit={savePassword}>
            <Input label="Current password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" required />
            <Input label="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required minLength={6} />
            <Input label="Confirm new password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required />

            {pwError ? <Alert variant="error">{pwError}</Alert> : null}
            {pwSuccess ? <Alert variant="success">{pwSuccess}</Alert> : null}

            <Button type="submit" disabled={pwSaving} className="w-full">
              {pwSaving ? "Saving..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
