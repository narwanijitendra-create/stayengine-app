"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function AdminLogin() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // If this account belongs to a hotel, route by role: waiters go to the
    // dedicated order-taking screen, everyone else to the full dashboard.
    const { data: hu } = await supabase
      .from("hotel_users")
      .select("id, role")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();
    setLoading(false);

    if (hu) {
      router.push(hu.role === "waiter" ? "/admin/waiter" : hu.role === "kitchen" ? "/admin/kitchen" : "/admin/dashboard");
      return;
    }

    // No hotel — if this is a platform admin, send them to super admin
    // instead of the "set up your hotel" screen.
    const { data: pa } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    router.push(pa ? "/super-admin" : "/admin/dashboard");
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-lg font-medium mb-1">Hotel admin login</h1>
      <p className="text-sm text-gray-500 mb-6">Sign in to manage your property.</p>
      <form onSubmit={handleLogin} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-md py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-6">
        New hotel?{" "}
        <a href="/admin/signup" className="underline">
          Create an account
        </a>
      </p>
    </main>
  );
}
