import React, { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { UserCircle } from "lucide-react";
import api from "../api/client.js";
import { useAuth } from "../state/auth.jsx";
import { Alert, Button, Card, Input } from "../ui/components.jsx";
import { getApiErrorMessage } from "../utils/apiError.js";

const DOMAIN = "@testsolutions.de";

export default function RequestAccess() {
  const { isAuthed } = useAuth();
  if (isAuthed) return <Navigate to="/rooms" replace />;
  const navigate = useNavigate();
  const [tab, setTab] = useState("request"); // "request" | "check"

  // Request form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Status check
  const [checkEmail, setCheckEmail] = useState("");
  const [checkError, setCheckError] = useState("");
  const [checkLoading, setCheckLoading] = useState(false);

  const domainOk = useMemo(() => !email || email.toLowerCase().endsWith(DOMAIN), [email]);
  const checkDomainOk = useMemo(
    () => !checkEmail || checkEmail.toLowerCase().endsWith(DOMAIN),
    [checkEmail]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.toLowerCase().endsWith(DOMAIN)) {
      setError("Please use your company email to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/request-access", { fullName, email, password, reason });
      // Redirect to status page with the submitted email
      navigate(`/request-status?email=${encodeURIComponent(email.toLowerCase())}`);
    } catch (e2) {
      setError(getApiErrorMessage(e2, "Could not submit your request."));
    } finally {
      setLoading(false);
    }
  }

  async function onCheckStatus(e) {
    e.preventDefault();
    setCheckError("");
    if (!checkEmail.toLowerCase().endsWith(DOMAIN)) {
      setCheckError("Please use your company email to continue.");
      return;
    }
    setCheckLoading(true);
    try {
      navigate(`/request-status?email=${encodeURIComponent(checkEmail.toLowerCase())}`);
    } finally {
      setCheckLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="p-6">
        {/* Tab switcher */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setTab("request")}
            className={[
              "flex-1 py-2 text-sm font-semibold transition",
              tab === "request"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            Request Access
          </button>
          <button
            type="button"
            onClick={() => setTab("check")}
            className={[
              "flex-1 py-2 text-sm font-semibold transition",
              tab === "check"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            Check Status
          </button>
        </div>

        {tab === "request" ? (
          <>
            <div className="text-xl font-extrabold text-slate-900">Request Access</div>
            <div className="mt-1 text-sm text-slate-600">
              Submit your details and an admin will approve your account.
            </div>

            <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
              <Input
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
              <div>
                <Input
                  label="Company email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                {!domainOk ? (
                  <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Please use your company email to continue.
                  </div>
                ) : null}
              </div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <Input
                label="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need access?"
              />

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button disabled={loading || !domainOk} type="submit">
                {loading ? "Submitting..." : "Submit request"}
              </Button>
            </form>

            <div className="mt-4 text-sm text-slate-600">
              Already approved?{" "}
              <Link className="font-semibold text-blue-700 hover:underline" to="/login">
                Login
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-xl font-extrabold text-slate-900">Check Request Status</div>
            <div className="mt-1 text-sm text-slate-600">
              Enter your email to see the current status of your access request.
            </div>

            <form className="mt-6 grid gap-4" onSubmit={onCheckStatus}>
              <div>
                <Input
                  label="Company email"
                  type="email"
                  value={checkEmail}
                  onChange={(e) => setCheckEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                {!checkDomainOk ? (
                  <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Please use your company email to continue.
                  </div>
                ) : null}
              </div>

              {checkError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {checkError}
                </div>
              ) : null}

              <Button disabled={checkLoading || !checkDomainOk} type="submit">
                {checkLoading ? "Checking..." : "Check my request status"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
