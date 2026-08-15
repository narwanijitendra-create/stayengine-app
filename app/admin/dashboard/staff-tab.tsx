"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

type StaffRow = {
  id: string;
  role: string;
  full_name: string | null;
  email: string;
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("hotel_users")
      .select("id, role, full_name, email, created_at")
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

  const waiters = staff.filter((s) => s.role === "waiter");
  const kitchenStaff = staff.filter((s) => s.role === "kitchen");

  return (
    <div>
      <div className="border border-gray-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-medium mb-1">Add staff</p>
        <p className="text-xs text-gray-500 mb-3">
          Waiters get their own login to take dine-in orders by table and update order status.
          Kitchen staff get a login to see incoming orders and acknowledge them into preparation.
          Neither can see bookings, rooms, or hotel settings.
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
              <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <p>{s.full_name || s.email}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <button onClick={() => removeStaff(s.id)} className="text-xs text-red-600">
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            <div className="p-3 text-xs text-gray-400 bg-gray-50 rounded-t-xl">Kitchen</div>
            {kitchenStaff.length === 0 && <p className="p-4 text-sm text-gray-500">No kitchen accounts yet.</p>}
            {kitchenStaff.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <p>{s.full_name || s.email}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <button onClick={() => removeStaff(s.id)} className="text-xs text-red-600">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
