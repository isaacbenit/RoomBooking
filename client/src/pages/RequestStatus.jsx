import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { Button, Card } from "../ui/components.jsx";

function StatusDisplay({ status, fullName, createdAt }) {
  if (status === "approved") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <div className="text-xl font-extrabold text-slate-900">Account Approved!</div>
        <div className="mt-2 text-sm text-slate-600">
          {fullName ? `Welcome, ${fullName}! ` : ""}Your account is ready. You can now log in.
        </div>
        <div className="mt-6">
          <Link to="/login">
            <Button>Login Now</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">❌</div>
        <div className="text-xl font-extrabold text-slate-900">Request Not Approved</div>
        <div className="mt-2 text-sm text-slate-600">
          Your request was not approved. Please contact your administrator for more information.
        </div>
        <div className="mt-6">
          <Link to="/register">
            <Button variant="outline">Submit a new request</Button>
          </Link>
        </div>
      </div>
    );
  }

  // pending
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">🟡</div>
      <div className="text-xl font-extrabold text-slate-900">Request Pending</div>
      <div className="mt-2 text-sm text-slate-600">
        Your request is under review. Please check back later.
      </div>
      {createdAt ? (
        <div className="mt-3 text-xs text-slate-500">
          Submitted on {new Date(createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      ) : null}
      <div className="mt-6 text-sm text-slate-500">
        An administrator will review your request shortly.
      </div>
    </div>
  );
}

export default function RequestStatus() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [status, setStatus] = useState(null);
  const [fullName, setFullName] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(emailParam));

  useEffect(() => {
    if (!emailParam) return;
    setLoading(true);
    setError("");
    api
      .get("/api/auth/request-status", { params: { email: emailParam } })
      .then(({ data }) => {
        setStatus(data.status);
        setFullName(data.fullName);
        setCreatedAt(data.createdAt);
      })
      .catch((e) => {
        setError(e?.response?.data?.error || "Could not fetch request status.");
      })
      .finally(() => setLoading(false));
  }, [emailParam]);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="p-8">
        {loading ? (
          <div className="text-center text-sm text-slate-500">Checking status...</div>
        ) : error ? (
          <div className="text-center">
            <div className="text-5xl mb-4">🔍</div>
            <div className="text-base font-bold text-slate-900">No request found</div>
            <div className="mt-2 text-sm text-slate-600">{error}</div>
            <div className="mt-6">
              <Link to="/register">
                <Button variant="outline">Submit a request</Button>
              </Link>
            </div>
          </div>
        ) : status ? (
          <StatusDisplay status={status} fullName={fullName} createdAt={createdAt} />
        ) : (
          <div className="text-center text-sm text-slate-500">
            No email provided.{" "}
            <Link className="font-semibold text-blue-700 hover:underline" to="/register">
              Go back
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
