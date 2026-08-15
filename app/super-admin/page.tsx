"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Hotel } from "@/lib/types";

type PlatformAdminRow = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  active: "bg-green-50 text-green-800 border-green-200",
  suspended: "bg-red-50 text-red-800 border-red-200",
  trial: "bg-blue-50 text-blue-800 border-blue-200",
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function SuperAdmin() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [admins, setAdmins] = useState<PlatformAdminRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newHotel, setNewHotel] = useState({ name: "", slug: "", ownerEmail: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ hotelName: string; email: string; password: string } | null>(
    null
  );

  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  async function loadAll() {
    const [{ data: h }, { data: pa }] = await Promise.all([
      supabase.from("hotels").select("*").order("created_at", { ascending: false }),
      supabase.from("platform_admins").select("id, email, full_name, created_at").order("created_at"),
    ]);
    setHotels(h ?? []);
    setAdmins(pa ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/admin/login");
        return;
      }
      const { data: pa } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();

      if (!pa) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);
      await loadAll();
      setLoading(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  async function setHotelStatus(id: string, status: string) {
    setBusyId(id);
    await supabase.from("hotels").update({ status }).eq("id", id);
    await loadAll();
    setBusyId(null);
  }

  async function setModule(id: string, field: "booking_enabled" | "restaurant_enabled", value: boolean) {
    setBusyId(id);
    await supabase.from("hotels").update({ [field]: value }).eq("id", id);
    await loadAll();
    setBusyId(null);
  }

  async function toggleCurrencyLock(id: string, locked: boolean) {
    setBusyId(id);
    await supabase.from("hotels").update({ currency_locked: locked }).eq("id", id);
    await loadAll();
    setBusyId(null);
  }

  async function createHotel(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreatedCreds(null);
    if (!newHotel.name.trim() || !newHotel.slug.trim() || !newHotel.ownerEmail.trim()) {
      setCreateError("Please fill in the hotel name, URL, and owner email.");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .rpc("create_hotel_with_owner", {
        p_hotel_name: newHotel.name.trim(),
        p_slug: slugify(newHotel.slug),
        p_owner_email: newHotel.ownerEmail.trim(),
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      setCreateError(
        error.message.includes("duplicate") && error.message.includes("slug")
          ? "That URL is already taken."
          : error.message.includes("already exists")
          ? "An account with that owner email already exists."
          : error.message
      );
      return;
    }
    const row = data as { hotel_id: string; owner_email: string; owner_password: string } | null;
    setCreatedCreds({ hotelName: newHotel.name.trim(), email: row?.owner_email ?? "", password: row?.owner_password ?? "" });
    setNewHotel({ name: "", slug: "", ownerEmail: "" });
    await loadAll();
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    const { error } = await supabase.rpc("add_platform_admin_by_email", {
      p_email: newAdminEmail.trim(),
    });
    setAddingAdmin(false);
    if (error) {
      setAdminError(error.message);
      return;
    }
    setNewAdminEmail("");
    await loadAll();
  }

  if (loading) return <main className="max-w-5xl mx-auto px-6 py-16 text-sm text-gray-500">Loading...</main>;

  if (!authorized) {
    return (
      <main className="max-w-md mx-auto px-6 py-24 text-sm text-gray-500">
        <h1 className="text-lg font-medium text-gray-900 mb-2">Not authorized</h1>
        <p>Your account doesn&apos;t have super admin access.</p>
      </main>
    );
  }

  const pending = hotels.filter((h) => h.status === "pending");
  const others = hotels.filter((h) => h.status !== "pending");

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">StayEngine</p>
          <h1 className="text-xl font-medium">Super admin</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            className="text-xs border border-gray-300 rounded-md px-3 py-1.5"
          >
            Sign out
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-3">Pending approval ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between border border-amber-200 bg-amber-50 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-gray-500">{h.slug}.stayengine.app</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/admin/dashboard?hotel=${h.id}`}
                    className="text-xs border border-gray-300 rounded-md px-3 py-1.5 inline-block"
                  >
                    Manage
                  </a>
                  <button
                    disabled={busyId === h.id}
                    onClick={() => setHotelStatus(h.id, "active")}
                    className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === h.id}
                    onClick={() => setHotelStatus(h.id, "suspended")}
                    className="text-xs border border-gray-300 rounded-md px-3 py-1.5 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">All hotels ({hotels.length})</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-normal">Hotel</th>
                <th className="text-left px-4 py-2 font-normal">URL</th>
                <th className="text-left px-4 py-2 font-normal">Plan</th>
                <th className="text-left px-4 py-2 font-normal">Currency</th>
                <th className="text-left px-4 py-2 font-normal">Status</th>
                <th className="text-left px-4 py-2 font-normal">Modules</th>
                <th className="text-right px-4 py-2 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {others.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{h.name}</td>
                  <td className="px-4 py-2 text-gray-500">{h.slug}.stayengine.app</td>
                  <td className="px-4 py-2 text-gray-500">{h.plan}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500">{h.currency}</span>
                      {h.currency_locked && (
                        <span className="text-[10px] border border-gray-300 rounded-full px-1.5 py-0.5 text-gray-500">
                          locked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_STYLES[h.status] ?? ""}`}
                    >
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <button
                        disabled={busyId === h.id}
                        onClick={() => setModule(h.id, "booking_enabled", !h.booking_enabled)}
                        className={`text-[10px] rounded-full px-2 py-0.5 border disabled:opacity-50 ${
                          h.booking_enabled
                            ? "bg-green-50 text-green-800 border-green-200"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}
                      >
                        Booking {h.booking_enabled ? "on" : "off"}
                      </button>
                      <button
                        disabled={busyId === h.id}
                        onClick={() => setModule(h.id, "restaurant_enabled", !h.restaurant_enabled)}
                        className={`text-[10px] rounded-full px-2 py-0.5 border disabled:opacity-50 ${
                          h.restaurant_enabled
                            ? "bg-green-50 text-green-800 border-green-200"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}
                      >
                        Restaurant {h.restaurant_enabled ? "on" : "off"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/admin/dashboard?hotel=${h.id}`}
                      className="text-xs border border-gray-300 rounded-md px-3 py-1 mr-2 inline-block"
                    >
                      Manage
                    </a>
                    {h.status === "active" ? (
                      <button
                        disabled={busyId === h.id}
                        onClick={() => setHotelStatus(h.id, "suspended")}
                        className="text-xs border border-gray-300 rounded-md px-3 py-1 mr-2 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        disabled={busyId === h.id}
                        onClick={() => setHotelStatus(h.id, "active")}
                        className="text-xs border border-gray-300 rounded-md px-3 py-1 mr-2 disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      disabled={busyId === h.id}
                      onClick={() => toggleCurrencyLock(h.id, !h.currency_locked)}
                      className="text-xs border border-gray-300 rounded-md px-3 py-1 disabled:opacity-50"
                    >
                      {h.currency_locked ? "Unlock currency" : "Lock currency"}
                    </button>
                  </td>
                </tr>
              ))}
              {others.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-xs">
                    No other hotels yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">Create a hotel directly</h2>
        <form onSubmit={createHotel} className="flex gap-2 flex-wrap items-start">
          <input
            type="text"
            placeholder="Hotel name"
            value={newHotel.name}
            onChange={(e) => setNewHotel((f) => ({ ...f, name: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="url-slug"
            value={newHotel.slug}
            onChange={(e) => setNewHotel((f) => ({ ...f, slug: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Owner's email"
            value={newHotel.ownerEmail}
            onChange={(e) => setNewHotel((f) => ({ ...f, ownerEmail: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            disabled={creating}
            className="bg-gray-900 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
        {createError && <p className="text-xs text-red-600 mt-2">{createError}</p>}
        {createdCreds && (
          <div className="mt-3 border border-green-200 bg-green-50 rounded-lg px-4 py-3 text-sm">
            <p className="font-medium text-green-800 mb-1">
              {createdCreds.hotelName} created — save these owner login details now, they won&apos;t be shown again:
            </p>
            <p className="text-green-900">
              Email: <span className="font-mono">{createdCreds.email}</span>
            </p>
            <p className="text-green-900">
              Password: <span className="font-mono">{createdCreds.password}</span>
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Email: ${createdCreds.email}\nPassword: ${createdCreds.password}\nLogin: ${window.location.origin}/admin/login`
                );
              }}
              className="text-xs border border-green-300 rounded-md px-2.5 py-1 mt-2"
            >
              Copy
            </button>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Creates the hotel and a real owner login in one step — the owner can sign in at
          /admin/login and manage their own hotel independently.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Super admins</h2>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-3">
          {admins.map((a) => (
            <div key={a.id} className="px-4 py-2 text-sm flex items-center justify-between">
              <span>{a.full_name ? `${a.full_name} — ${a.email}` : a.email}</span>
            </div>
          ))}
        </div>
        <form onSubmit={addAdmin} className="flex gap-2">
          <input
            type="email"
            placeholder="Email of an existing account"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 max-w-xs"
          />
          <button
            disabled={addingAdmin}
            className="border border-gray-300 rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {addingAdmin ? "Adding..." : "Add as super admin"}
          </button>
        </form>
        {adminError && <p className="text-xs text-red-600 mt-2">{adminError}</p>}
      </section>
    </main>
  );
}
