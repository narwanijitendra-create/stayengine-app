"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

type StaffRow = {
  id: string;
  role: string;
  full_name: string | null;
  email: string;
  is_suspended: boolean;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  waiter: "Waiter",
  kitchen: "Kitchen",
};

export default function StaffTab({ hotelId }: { hotelId: string }) {
  const supabase = createBrowserClient();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: "", email: "", role: "waiter" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [resetCreds, setResetCreds] = useState<{ id: string; email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("hotel_users")
      .select("id, role, full_name, email, is_suspended, created_at")
      .eq("hotel_id", hotelId)
      .in("role", ["waiter", "kitchen"])
      .order("created_at", { ascending: true });
    setStaff(data ?? []);
    setLoading(false);
  }

  async function addStaff() {
    if (!form.email.trim() || !form.full_name.trim()) return;
    setSaving(true);
    setError(null);
    setCreatedCreds(null);
    const { data, error } = await supabase.rpc("create_hotel_staff", {
      p_hotel_id: hotelId,
      p_email: form.email.trim(),
      p_full_name: form.full_name.trim(),
      p_role: form.role,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setCreatedCreds({ email: row.email, password: row.password });
    setForm({ full_name: "", email: "", role: form.role });
    load();
  }

  async function removeStaff(id: string) {
    if (!confirm("Remove this staff account? They will no longer be able to log in.")) return;
    const { error } = await supabase.from("hotel_users").delete().eq("id", id);
    if (!error) setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  async function resetPassword(row: StaffRow) {
    if (!confirm(`Reset the password for ${row.full_name || row.email}? Their current password will stop working.`)) return;
    setBusyId(row.id);
    setResetCreds(null);
    const { data, error } = await supabase.rpc("reset_hotel_staff_password", { p_user_id: row.id });
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (result) setResetCreds({ id: row.id, email: result.email, password: result.password });
  }

  async function toggleSuspend(row: StaffRow) {
    const next = !row.is_suspended;
    if (next && !confirm(`Suspend ${row.full_name || row.email}? They won't be able to log in until unsuspended.`)) return;
    setBusyId(row.id);
    const { error } = await supabase.rpc("set_hotel_staff_suspended", { p_user_id: row.id, p_suspended: next });
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === row.id ? { ...s, is_suspended: next } : s)));
  }

  const waiters = staff.filter((s) => s.role === "waiter");
  const kitchenStaff = staff.filter((s) => s.role === "kitchen");

  function StaffRowItem({ s }: { s: StaffRow }) {
    return (
      <div className="p-3 text-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <p>{s.full_name || s.email}</p>
              {s.is_suspended && (
                <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  Suspended
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{s.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => resetPassword(s)}
              disabled={busyId === s.id}
              className="text-xs text-gray-600 underline disabled:opacity-50"
            >
              Reset password
            </button>
            <button
              onClick={() => toggleSuspend(s)}
              disabled={busyId === s.id}
              className="text-xs text-amber-700 underline disabled:opacity-50"
            >
              {s.is_suspended ? "Unsuspend" : "Suspend"}
            </button>
            <button onClick={() => removeStaff(s.id)} className="text-xs text-red-600 underline">
              Remove
            </button>
          </div>
        </div>
        {resetCreds && resetCreds.id === s.id && (
          <div className="mt-2 text-xs bg-green-50 border border-green-200 rounded-md p-3 text-green-800">
            <p className="font-medium mb-1">New password — share this with them now:</p>
            <p>Email: {resetCreds.email}</p>
            <p>Password: {resetCreds.password}</p>
            <p className="text-green-600 mt-1">This password won&apos;t be shown again.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="border border-gray-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-medium mb-1">Add staff</p>
        <p className="text-xs text-gray-500 mb-3">
          Waiters get their own login to take dine-in orders by table and update order status.
          Kitchen staff get a login to see incoming orders and acknowledge them into preparation.
          Neither can see bookings, rooms, or hotel settings. Staff can&apos;t change their own
          password — reset it here if they forget it.
        </p>
        <div className="grid sm:grid-cols-3 gap-2 mb-2">
          <input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="waiter">Waiter</option>
            <option value="kitchen">Kitchen</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button
          onClick={addStaff}
          disabled={saving || !form.full_name.trim() || !form.email.trim()}
          className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {saving ? "Creating..." : `Create ${ROLE_LABELS[form.role]?.toLowerCase() ?? ""} account`}
        </button>

        {createdCreds && (
          <div className="mt-3 text-xs bg-green-50 border border-green-200 rounded-md p-3 text-green-800">
            <p className="font-medium mb-1">Account created — share these credentials with them now:</p>
            <p>Email: {createdCreds.email}</p>
            <p>Password: {createdCreds.password}</p>
            <p className="text-green-600 mt-1">This password won&apos;t be shown again.</p>
          </div>
        )}
      </div>

      {loading && <p className="p-4 text-sm text-gray-500">Loading...</p>}

      {!loading && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            <div className="p-3 text-xs text-gray-400 bg-gray-50 rounded-t-xl">Waiters</div>
            {waiters.length === 0 && <p className="p-4 text-sm text-gray-500">No waiter accounts yet.</p>}
            {waiters.map((s) => (
              <StaffRowItem key={s.id} s={s} />
            ))}
          </div>

          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            <div className="p-3 text-xs text-gray-400 bg-gray-50 rounded-t-xl">Kitchen</div>
            {kitchenStaff.length === 0 && <p className="p-4 text-sm text-gray-500">No kitchen accounts yet.</p>}
            {kitchenStaff.map((s) => (
              <StaffRowItem key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
