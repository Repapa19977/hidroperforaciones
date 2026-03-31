"use client";

import { useState, useEffect } from "react";
import AdminLogin from "@/components/admin/admin-login";
import AdminDashboard from "@/components/admin/admin-dashboard";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("hidro_admin_token");
    const savedUser = localStorage.getItem("hidro_admin_user");
    if (saved && savedUser) {
      setToken(saved);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function handleLogin(newToken: string, userData: { name: string; email: string }) {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem("hidro_admin_token", newToken);
    localStorage.setItem("hidro_admin_user", JSON.stringify(userData));
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("hidro_admin_token");
    localStorage.removeItem("hidro_admin_user");
  }

  if (!token) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminDashboard token={token} user={user!} onLogout={handleLogout} />;
}
