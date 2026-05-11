import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../state/auth.jsx";
import { Button, Card, Input, Select, Badge } from "../ui/components.jsx";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Employee");
  const [adminInfo, setAdminInfo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api
      .get("/api/auth/admin-count")
      .then((r) => {
        if (alive) setAdminInfo(r.data);
      })
      .catch(() => {
        if (alive) setAdminInfo({ adminCount: 0, adminCap: 5, canRegisterAdmin: true });
      });
    return () => {
      alive = false;
    };
  }, []);

  const canPickAdmin = adminInfo?.canRegisterAdmin ?? true;
  const adminLabel = useMemo(() => {
    if (!adminInfo) return "Admin";
    return adminInfo.canRegisterAdmin
      ? `Admin (remaining: ${Math.max(0, adminInfo.adminCap - adminInfo.adminCount)})`
      : "Admin (cap reached)";
  }, [adminInfo]);

  useEffect(() => {
    if (!canPickAdmin && role === "Admin") setRole("Employee");
  }, [canPickAdmin, role]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/register", {
        fullName,
        email,
        password,
        role,
      });
      login(data);
      navigate("/rooms");
    } catch (e2) {
      setError(
        e2?.response?.data?.error ||
          (e2?.message ? `Registration failed: ${e2.message}` : "Registration failed")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="p-6">
        <div className="text-xl font-extrabold text-slate-900">Create account</div>
        <div className="mt-1 text-sm text-slate-600">
          Choose your role and get started.
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <Badge tone="slate">Admin cap</Badge>
          <span>
            {adminInfo
              ? `${adminInfo.adminCount}/${adminInfo.adminCap} admins registered`
              : "Checking admin capacity..."}
          </span>
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
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password (min 8 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />

          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            {canPickAdmin ? <option value="Admin">{adminLabel}</option> : null}
            <option value="Employee">Employee</option>
          </Select>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button disabled={loading} type="submit">
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          Have an account?{" "}
          <Link className="font-semibold text-blue-700 hover:underline" to="/login">
            Login
          </Link>
        </div>
      </Card>
    </div>
  );
}

