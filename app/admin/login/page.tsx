"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function AdminLogin() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("suspended") ? "Your account has been suspended. Contact your hotel admin." : null
  );
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

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
      .select("id, role, is_suspended")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (hu?.is_suspended) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Your account has been suspended. Contact your hotel admin.");
      return;
    }
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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotBusy(true);
    setForgotMessage(null);

    // Waiter/kitchen accounts don't get self-service reset - only the hotel
    // owner can reset their password, from the Staff tab.
    const { data: isStaff } = await supabase.rpc("is_staff_account", { p_email: forgotEmail.trim() });
    if (isStaff) {
      setForgotBusy(false);
      setForgotMessage("Staff accounts are managed by your hotel admin — ask them to reset your password from the Staff tab.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setForgotBusy(false);
    setForgotMessage(
      error ? error.message : "If an account exists for that email, a reset link has been sent."
    );
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

      <button
        onClick={() => {
          setShowForgot((v) => !v);
          setForgotMessage(null);
          setForgotEmail(email);
        }}
        className="text-xs text-gray-500 underline mt-3"
      >
        Forgot password?
      </button>

      {showForgot && (
        <form onSubmit={handleForgotPassword} className="mt-3 border border-gray-200 rounded-md p-3 space-y-2">
          <p className="text-xs text-gray-500">Hotel owners: enter your email and we&apos;ll send a reset link.</p>
          <input
            type="email"
            placeholder="Email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          {forgotMessage && <p className="text-xs text-gray-600">{forgotMessage}</p>}
          <button
            disabled={forgotBusy || !forgotEmail.trim()}
            className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {forgotBusy ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <p className="text-xs text-gray-400 mt-6">
        New hotel?{" "}
        <a href="/admin/signup" className="underline">
          Create an account
        </a>
      </p>
    </main>
  );
}
