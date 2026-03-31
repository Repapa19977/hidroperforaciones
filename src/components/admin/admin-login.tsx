"use client";

import { useState } from "react";

interface Props {
  onLogin: (token: string, user: { name: string; email: string }) => void;
}

export default function AdminLogin({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "setup") {
        const res = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al crear cuenta");
          setLoading(false);
          return;
        }
        setMode("login");
        setError("");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesion");
        setLoading(false);
        return;
      }

      onLogin(data.token, data.user);
    } catch {
      setError("Error de conexion");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-900 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0 0c-3 0-6-2-6-6 0-3 2-5 4-8l2-4 2 4c2 3 4 5 4 8 0 4-3 6-6 6z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === "setup" ? "Crear Administrador" : "Panel Admin"}
          </h1>
          <p className="text-sm text-secondary mt-1">Hidroperforaciones SA</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-2xl bg-card border border-border/50 space-y-4"
        >
          {mode === "setup" && (
            <div>
              <label className="block text-sm text-secondary mb-1">Nombre</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-secondary mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <label className="block text-sm text-secondary mb-1">Contrasena</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-black font-semibold text-sm transition-colors"
          >
            {loading
              ? "Cargando..."
              : mode === "setup"
              ? "Crear Cuenta"
              : "Iniciar Sesion"}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "setup" : "login")}
            className="w-full text-xs text-secondary hover:text-secondary transition-colors"
          >
            {mode === "login"
              ? "Primera vez? Crear administrador"
              : "Ya tengo cuenta? Iniciar sesion"}
          </button>
        </form>
      </div>
    </div>
  );
}
