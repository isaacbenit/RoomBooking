import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../state/auth.jsx";
import { Button, Card, Input } from "../ui/components.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      login(data);
      navigate("/rooms");
    } catch (e2) {
      setError(
        e2?.response?.data?.error ||
          (e2?.message ? `Login failed: ${e2.message}` : "Login failed")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="p-6">
        <div className="text-xl font-extrabold text-slate-900">Login</div>
        <div className="mt-1 text-sm text-slate-600">
          Use your email and password to continue.
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          No account?{" "}
          <Link className="font-semibold text-blue-700 hover:underline" to="/register">
            Register
          </Link>
        </div>
      </Card>
    </div>
  );
}

