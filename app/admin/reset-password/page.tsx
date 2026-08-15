"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

// Landing page for the link in a Supabase password-recovery email
// (see the "Forgot password?" flow on /admin/login). The Supabase client
// auto-detects the recovery token in the URL on load and turns it into a
// signed-in session, firing a PASSWORD_RECOVERY auth event - once that
// happens we let the person set a new password via supabase.auth.updateUser.
export default function ResetPasswordPage() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Fallback: if a session already exists (link already processed) by the
    // time this mounts, allow the form anyway rather than waiting forever.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/admin/login"), 1500);
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-lg font-medium mb-1">Set a new password</h1>

      {!ready && !done && (
        <p className="text-sm text-gray-500 mt-4">
          Waiting for the reset link to verify — if this doesn&apos;t update in a few seconds, the link may have
          expired. Request a new one from the login page.
        </p>
      )}

      {ready && !done && (
        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save new password"}
          </button>
        </form>
      )}

      {done && <p className="text-sm text-green-700 mt-4">Password updated — redirecting to sign in...</p>}
    </main>
  );
}
