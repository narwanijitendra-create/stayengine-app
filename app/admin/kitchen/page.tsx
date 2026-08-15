"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { FoodOrder, Hotel } from "@/lib/types";
import { playTone } from "@/lib/sound";

type KitchenUserRow = {
  id: string;
  hotel_id: string;
  role: string;
  full_name: string | null;
  email: string;
  is_suspended: boolean;
  self_password_reset_allowed: boolean;
  hotels: Hotel;
};

// Kitchen only handles orders placed by waiters at a table - room service and
// delivery orders go straight to the owner (and now trigger an email), and
// don't need a kitchen acknowledgment step in this flow.
const ORDER_TYPE = "dine_in" as const;

export default function KitchenPage() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [kitchenUser, setKitchenUser] = useState<KitchenUserRow | null>(null);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showChangePw, setShowChangePw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  function generatePassword() {
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
  }

  async function handleGeneratePassword() {
    setPwSaving(true);
    setPwError(null);
    setGeneratedPassword(null);
    const newPassword = generatePassword();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setGeneratedPassword(newPassword);
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/admin/login");
        return;
      }

      const { data: hu } = await supabase
        .from("hotel_users")
        .select("id, hotel_id, role, full_name, email, is_suspended, self_password_reset_allowed, hotels(*)")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();

      if (!hu) {
        router.push("/admin/login");
        return;
      }
      if (hu.is_suspended) {
        await supabase.auth.signOut();
        router.push("/admin/login?suspended=1");
        return;
      }
      if (hu.role !== "kitchen") {
        router.push("/admin/dashboard");
        return;
      }

      const huTyped = hu as unknown as KitchenUserRow;
      setKitchenUser(huTyped);

      await loadOrders(huTyped.hotel_id);
      setLoading(false);

      const soundSettings = huTyped.hotels.notification_settings?.kitchen;

      // Keep the kitchen queue live as waiters place new orders. A new
      // order (INSERT) is the one event that should play a sound - status
      // updates from the kitchen's own actions shouldn't alert itself.
      const channel = supabase
        .channel(`kitchen-orders-${huTyped.hotel_id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "food_orders", filter: `hotel_id=eq.${huTyped.hotel_id}` },
          () => {
            if (soundSettings?.enabled) playTone(soundSettings.tone);
            loadOrders(huTyped.hotel_id);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "food_orders", filter: `hotel_id=eq.${huTyped.hotel_id}` },
          () => loadOrders(huTyped.hotel_id)
        )
        .subscribe();

      // Realtime is the primary way this page updates, but as a backup the
      // owner can set a hotel-wide polling interval (e.g. faster during busy
      // hours) from Hotel profile. 0 means polling is off.
      const intervalSeconds = huTyped.hotels.refresh_interval_seconds || 0;
      const poll =
        intervalSeconds > 0
          ? setInterval(() => loadOrders(huTyped.hotel_id), intervalSeconds * 1000)
          : null;

      return () => {
        supabase.removeChannel(channel);
        if (poll) clearInterval(poll);
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrders(hotelId: string) {
    // closed_at marks a table's dining session as fully settled by the
    // waiter - once closed, the kitchen doesn't need to see it again even
    // with "Show delivered/cancelled" checked.
    const { data } = await supabase
      .from("food_orders")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("order_type", ORDER_TYPE)
      .is("closed_at", null)
      .order("created_at", { ascending: true });
    setOrders((data as FoodOrder[]) || []);
  }

  async function handleManualRefresh() {
    if (!kitchenUser) return;
    setRefreshing(true);
    await loadOrders(kitchenUser.hotel_id);
    setRefreshing(false);
  }

  async function advanceStatus(order: FoodOrder, nextStatus: FoodOrder["status"]) {
    if (!kitchenUser) return;
    setUpdatingId(order.id);
    await supabase.from("food_orders").update({ status: nextStatus }).eq("id", order.id);
    await loadOrders(kitchenUser.hotel_id);
    setUpdatingId(null);
  }

  if (loading || !kitchenUser) {
    return <main className="max-w-3xl mx-auto px-6 py-16 text-sm text-gray-500">Loading...</main>;
  }

  const hotel = kitchenUser.hotels;
  const pending = orders.filter((o) => o.status === "pending");
  const confirmed = orders.filter((o) => o.status === "confirmed");
  const preparing = orders.filter((o) => o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");
  const done = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");

  function OrderCard({ order }: { order: FoodOrder }) {
    return (
      <div className="border border-gray-200 rounded-xl px-4 py-3 bg-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium">Table {order.table_number || "—"}</p>
          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</p>
        </div>
        <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
          {order.items.map((i, idx) => (
            <li key={idx}>
              {i.qty} × {i.name}
            </li>
          ))}
        </ul>
        {order.notes && <p className="text-xs text-gray-400 mt-1">Note: {order.notes}</p>}
        <div className="mt-3 flex items-center gap-2">
          {order.status === "pending" && (
            <button
              onClick={() => advanceStatus(order, "confirmed")}
              disabled={updatingId === order.id}
              className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
            >
              {updatingId === order.id ? "..." : "Acknowledge"}
            </button>
          )}
          {order.status === "confirmed" && (
            <>
              <button
                onClick={() => advanceStatus(order, "pending")}
                disabled={updatingId === order.id}
                className="text-xs border border-gray-300 rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={() => advanceStatus(order, "preparing")}
                disabled={updatingId === order.id}
                className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {updatingId === order.id ? "..." : "Start preparing"}
              </button>
            </>
          )}
          {order.status === "preparing" && (
            <>
              <button
                onClick={() => advanceStatus(order, "confirmed")}
                disabled={updatingId === order.id}
                className="text-xs border border-gray-300 rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={() => advanceStatus(order, "ready")}
                disabled={updatingId === order.id}
                className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {updatingId === order.id ? "..." : "Mark ready"}
              </button>
            </>
          )}
          {order.status === "ready" && (
            <>
              <button
                onClick={() => advanceStatus(order, "preparing")}
                disabled={updatingId === order.id}
                className="text-xs border border-gray-300 rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                Back
              </button>
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                Ready — waiter will serve &amp; close
              </span>
            </>
          )}
          {(order.status === "delivered" || order.status === "cancelled") && (
            <span className="text-xs text-gray-400">{order.status === "delivered" ? "served" : order.status}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-medium"
            style={{ background: hotel.brand_color || "#1F4E5F" }}
          >
            {hotel.name.slice(0, 1)}
          </div>
          <div>
            <p className="font-medium text-sm">{hotel.name}</p>
            <p className="text-xs text-gray-500">Kitchen · {kitchenUser.full_name || kitchenUser.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="text-xs border border-gray-300 rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {kitchenUser.self_password_reset_allowed && (
            <button
              onClick={() => {
                setShowChangePw((v) => !v);
                setPwError(null);
                setGeneratedPassword(null);
              }}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5"
            >
              Change password
            </button>
          )}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            className="text-xs border border-gray-300 rounded-md px-3 py-1.5"
          >
            Sign out
          </button>

          {showChangePw && (
            <div className="absolute right-0 top-10 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-2">
              <p className="text-xs font-medium">Change password</p>
              <p className="text-xs text-gray-500">
                Generates a new random password for your account and signs you in with it right away.
              </p>
              {pwError && <p className="text-xs text-red-600">{pwError}</p>}
              {generatedPassword && (
                <div className="text-xs bg-green-50 border border-green-200 rounded-md p-2 text-green-800">
                  <p className="font-medium mb-1">Your new password:</p>
                  <p className="font-mono">{generatedPassword}</p>
                  <p className="text-green-600 mt-1">Save it now — it won&apos;t be shown again.</p>
                </div>
              )}
              <button
                onClick={handleGeneratePassword}
                disabled={pwSaving}
                className="w-full text-xs bg-gray-900 text-white rounded-md py-1.5 disabled:opacity-50"
              >
                {pwSaving ? "Generating..." : "Generate new password"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">New ({pending.length})</p>
          <div className="space-y-2">
            {pending.length === 0 && <p className="text-xs text-gray-400">No new orders.</p>}
            {pending.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Acknowledged ({confirmed.length})</p>
          <div className="space-y-2">
            {confirmed.length === 0 && <p className="text-xs text-gray-400">Nothing here.</p>}
            {confirmed.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Preparing ({preparing.length})</p>
          <div className="space-y-2">
            {preparing.length === 0 && <p className="text-xs text-gray-400">Nothing here.</p>}
            {preparing.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Ready ({ready.length})</p>
          <div className="space-y-2">
            {ready.length === 0 && <p className="text-xs text-gray-400">Nothing here.</p>}
            {ready.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </div>
      </div>

      <label className="text-xs text-gray-500 flex items-center gap-1.5 mb-2">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        Show delivered/cancelled
      </label>
      {showDone && (
        <div className="grid sm:grid-cols-3 gap-2">
          {done.length === 0 && <p className="text-xs text-gray-400">None yet.</p>}
          {done.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </main>
  );
}
