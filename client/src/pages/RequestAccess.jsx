import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import { Button, Card, Input } from "../ui/components.jsx";

const DOMAIN = "@testsolutions.de";

export default function RequestAccess() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const domainOk = useMemo(
    () => !email || email.toLowerCase().endsWith(DOMAIN),
    [email]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.toLowerCase().endsWith(DOMAIN)) {
      setError("Use your organization email.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/request-access", {
        fullName,
        email,
        reason,
      });
      setSuccess(
        data?.message ||
          "Your request has been submitted. You will be able to log in once an administrator approves your account."
      );
      setFullName("");
      setEmail("");
      setReason("");
    } catch (e2) {
      setError(
        e2?.response?.data?.error ||
          (e2?.message ? `Request failed: ${e2.message}` : "Request failed")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="p-6">
        <div className="text-xl font-extrabold text-slate-900">
          Request registration access
        </div>
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
          <Input
            label="Organization email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {!domainOk ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Use your organization email.
            </div>
          ) : null}
          <Input
            label="Password"
            type="password"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}

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
      </Card>
    </div>
  );
}

