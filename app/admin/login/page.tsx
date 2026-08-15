"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
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

  const [showChangePw, setShowChangePw] = useState(false);
  const [cpEmail, setCpEmail] = useState("");
  const [cpCurrentPassword, setCpCurrentPassword] = useState("");
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirmPassword, setCpConfirmPassword] = useState("");
  const [cpBusy, setCpBusy] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpDone, setCpDone] = useState(false);

  // Shared with handleLogin: once we have an authenticated user, route them
  // by role (waiter/kitchen get their own screens, platform admins go to
  // super admin, everyone else lands on the hotel dashboard).
  async function routeAfterAuth(userId: string) {
    const { data: hu } = await supabase
      .from("hotel_users")
      .select("id, role, is_suspended")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (hu?.is_suspended) {
      await supabase.auth.signOut();
      setError("Your account has been suspended. Contact your hotel admin.");
      return;
    }

    if (hu) {
      router.push(hu.role === "waiter" ? "/admin/waiter" : hu.role === "kitchen" ? "/admin/kitchen" : "/admin/dashboard");
      return;
    }

    const { data: pa } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    router.push(pa ? "/super-admin" : "/admin/dashboard");
  }

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
    await routeAfterAuth(data.user.id);
    setLoading(false);
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

  // Lets an admin who still remembers their current password set a new one
  // right here, without waiting on a password-recovery email. Verifies the
  // current password first (signs in with it), then blocks staff accounts -
  // same "only the hotel admin manages staff passwords" rule as elsewhere.
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!cpEmail.trim() || !cpCurrentPassword) return;
    if (cpNewPassword.length < 6) {
      setCpError("New password must be at least 6 characters.");
      return;
    }
    if (cpNewPassword !== cpConfirmPassword) {
      setCpError("New passwords don't match.");
      return;
    }
    setCpBusy(true);
    setCpError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cpEmail.trim(),
      password: cpCurrentPassword,
    });
    if (error) {
      setCpBusy(false);
      setCpError(error.message);
      return;
    }

    const { data: hu } = await supabase
      .from("hotel_users")
      .select("id, role")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (hu && (hu.role === "waiter" || hu.role === "kitchen")) {
      await supabase.auth.signOut();
      setCpBusy(false);
      setCpError("Staff accounts are managed by your hotel admin — ask them to reset your password from the Staff tab.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: cpNewPassword });
    if (updateError) {
      setCpBusy(false);
      setCpError(updateError.message);
      return;
    }

    setCpDone(true);
    setCpBusy(false);
    setTimeout(() => routeAfterAuth(data.user.id), 1200);
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

      <div className="flex items-center gap-4 mt-3">
        <button
          onClick={() => {
            setShowForgot((v) => !v);
            setShowChangePw(false);
            setForgotMessage(null);
            setForgotEmail(email);
          }}
          className="text-xs text-gray-500 underline"
        >
          Forgot password?
        </button>
        <button
          onClick={() => {
            setShowChangePw((v) => !v);
            setShowForgot(false);
            setCpError(null);
            setCpDone(false);
            setCpEmail(email);
          }}
          className="text-xs text-gray-500 underline"
        >
          Change password
        </button>
      </div>

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

      {showChangePw && (
        <form onSubmit={handleChangePassword} className="mt-3 border border-gray-200 rounded-md p-3 space-y-2">
          <p className="text-xs text-gray-500">
            Hotel owners: enter your email and current password, then set a new one.
          </p>
          <input
            type="email"
            placeholder="Email"
            value={cpEmail}
            onChange={(e) => setCpEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Current password"
            value={cpCurrentPassword}
            onChange={(e) => setCpCurrentPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="New password"
            value={cpNewPassword}
            onChange={(e) => setCpNewPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={cpConfirmPassword}
            onChange={(e) => setCpConfirmPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          {cpError && <p className="text-xs text-red-600">{cpError}</p>}
          {cpDone && <p className="text-xs text-green-700">Password updated — signing you in...</p>}
          <button
            disabled={cpBusy || !cpEmail.trim() || !cpCurrentPassword || !cpNewPassword}
            className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {cpBusy ? "Updating..." : "Update password"}
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

export default function AdminLogin() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
