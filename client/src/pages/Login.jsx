import React, { useState } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import api from "../api/client.js";
import { useAuth } from "../state/auth.jsx";
import { Button, Card, Input, Alert } from "../ui/components.jsx";
import { getApiErrorMessage } from "../utils/apiError.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthed } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/rooms";
  const domainOk = !email || email.toLowerCase().endsWith("@testsolutions.de");

  if (isAuthed) return <Navigate to="/rooms" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      login(data);
      navigate(from, { replace: true });
    } catch (e2) {
      setError(getApiErrorMessage(e2, "Login failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <div className="mb-6 text-center">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-full mb-3" style={{ background: "#D1FAE5" }}>
          <LogIn size={20} style={{ color: "#2D6A4F" }} />
        </div>
        <h1 className="font-semibold text-gray-900" style={{ fontSize: "1.4rem" }}>Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">Use your TestSolutions email to continue</p>
      </div>

      <Card className="p-6">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {!domainOk ? (
            <Alert variant="warning">Please use your company email to continue.</Alert>
          ) : null}
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button disabled={loading || !domainOk} type="submit" className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-500">
          Need access?{" "}
          <Link className="font-medium hover:underline" style={{ color: "#2D6A4F" }} to="/register">
            Request Access
          </Link>
        </div>
      </Card>
    </div>
  );
}
