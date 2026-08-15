"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { MenuItem, MenuCategory, FoodOrder, FoodOrderItem, Hotel } from "@/lib/types";
import { buildMenuGroups } from "@/lib/menu";

type WaiterUserRow = {
  id: string;
  hotel_id: string;
  role: string;
  full_name: string | null;
  email: string;
  hotels: Hotel;
};

type CartLine = {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
};

const DINE_IN_STATUSES: FoodOrder["status"][] = ["pending", "confirmed", "preparing", "delivered", "cancelled"];

export default function WaiterPage() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [waiterUser, setWaiterUser] = useState<WaiterUserRow | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const [tableNumber, setTableNumber] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/admin/login");
        return;
      }

      const { data: hu } = await supabase
        .from("hotel_users")
        .select("id, hotel_id, role, full_name, email, hotels(*)")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();

      if (!hu) {
        router.push("/admin/login");
        return;
      }
      if (hu.role !== "waiter") {
        router.push("/admin/dashboard");
        return;
      }

      const huTyped = hu as unknown as WaiterUserRow;
      setWaiterUser(huTyped);

      const [{ data: itemsData }, { data: catsData }] = await Promise.all([
        supabase
          .from("menu_items")
          .select("*")
          .eq("hotel_id", huTyped.hotel_id)
          .eq("is_available", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("menu_categories")
          .select("*")
          .eq("hotel_id", huTyped.hotel_id)
          .order("sort_order", { ascending: true }),
      ]);
      setItems((itemsData as MenuItem[]) || []);
      setCategories((catsData as MenuCategory[]) || []);

      await loadOrders(huTyped.hotel_id);
      setLoading(false);

      // Keep the order queue live across multiple waiters/devices.
      const channel = supabase
        .channel(`dine-in-orders-${huTyped.hotel_id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "food_orders", filter: `hotel_id=eq.${huTyped.hotel_id}` },
          () => loadOrders(huTyped.hotel_id)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrders(hotelId: string) {
    const { data } = await supabase
      .from("food_orders")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("order_type", "dine_in")
      .order("created_at", { ascending: false });
    setOrders((data as FoodOrder[]) || []);
  }

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) => (c.menu_item_id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.menu_item_id === menuItemId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);

  async function placeOrder() {
    if (!waiterUser) return;
    if (!tableNumber.trim()) {
      setPlaceError("Enter a table number.");
      return;
    }
    if (cart.length === 0) {
      setPlaceError("Add at least one item.");
      return;
    }
    setPlaceError(null);
    setPlacing(true);
    const orderItems: FoodOrderItem[] = cart.map((c) => ({
      menu_item_id: c.menu_item_id,
      name: c.name,
      price: c.price,
      qty: c.qty,
    }));
    const { error } = await supabase.from("food_orders").insert({
      hotel_id: waiterUser.hotel_id,
      order_type: "dine_in",
      customer_name: `Table ${tableNumber.trim()}`,
      phone: "N/A",
      table_number: tableNumber.trim(),
      items: orderItems,
      total_amount: cartTotal,
      currency: waiterUser.hotels.currency || "USD",
      status: "pending",
      notes: notes.trim() || null,
    });
    setPlacing(false);
    if (error) {
      setPlaceError(error.message);
      return;
    }
    setCart([]);
    setNotes("");
    setTableNumber("");
    loadOrders(waiterUser.hotel_id);
  }

  async function updateStatus(id: string, status: FoodOrder["status"]) {
    await supabase.from("food_orders").update({ status }).eq("id", id);
    if (waiterUser) loadOrders(waiterUser.hotel_id);
  }

  if (loading || !waiterUser) {
    return <main className="max-w-3xl mx-auto px-6 py-16 text-sm text-gray-500">Loading...</main>;
  }

  const hotel = waiterUser.hotels;
  const searchQuery = itemSearch.trim().toLowerCase();
  const filteredItems = searchQuery ? items.filter((i) => i.name.toLowerCase().includes(searchQuery)) : items;
  const groups = buildMenuGroups(filteredItems, categories);
  const visibleOrders = showAllOrders ? orders : orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
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
            <p className="text-xs text-gray-500">Waiter · {waiterUser.full_name || waiterUser.email}</p>
          </div>
        </div>
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

      <div className="border border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium mb-3">New order</p>
        <div className="flex gap-2 mb-3">
          <input
            placeholder="Table number"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40"
          />
          <input
            placeholder="Search items..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
          />
        </div>

        {groups.length === 0 ? (
          <p className="text-xs text-gray-400 mb-3">
            {searchQuery ? `No items match "${itemSearch.trim()}".` : "No available menu items yet."}
          </p>
        ) : (
          groups.map((group) => (
            <div key={`${group.category.id}-${group.subcategory?.id ?? "none"}`} className="mb-3">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1.5">
                {group.category.name}
                {group.subcategory ? ` / ${group.subcategory.name}` : ""}
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex items-center justify-between text-left text-sm border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50"
                  >
                    <span>{item.name}</span>
                    <span className="text-xs text-gray-500">{item.price}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        {cart.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2">Cart</p>
            <div className="space-y-1.5 mb-2">
              {cart.map((c) => (
                <div key={c.menu_item_id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(c.menu_item_id, -1)}
                      className="w-5 h-5 border border-gray-300 rounded text-xs leading-none"
                    >
                      −
                    </button>
                    <span className="text-xs w-4 text-center">{c.qty}</span>
                    <button
                      onClick={() => changeQty(c.menu_item_id, 1)}
                      className="w-5 h-5 border border-gray-300 rounded text-xs leading-none"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-500 w-12 text-right">{(c.price * c.qty).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium mb-2">
              Total: {cartTotal.toFixed(2)} {hotel.currency}
            </p>
            <textarea
              placeholder="Notes for the kitchen (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full mb-2"
            />
          </div>
        )}

        {placeError && <p className="text-xs text-red-600 mb-2">{placeError}</p>}
        <button
          onClick={placeOrder}
          disabled={placing || cart.length === 0}
          className="text-sm bg-gray-900 text-white rounded-md px-4 py-2 disabled:opacity-50"
        >
          {placing ? "Placing..." : "Place order"}
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Table orders</p>
        <label className="text-xs text-gray-500 flex items-center gap-1.5">
          <input type="checkbox" checked={showAllOrders} onChange={(e) => setShowAllOrders(e.target.checked)} />
          Show completed/cancelled
        </label>
      </div>

      {visibleOrders.length === 0 ? (
        <p className="text-sm text-gray-400">No open table orders.</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {visibleOrders.map((order) => (
            <div key={order.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium">Table {order.table_number || "—"}</p>
                  <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value as FoodOrder["status"])}
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                >
                  {DINE_IN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                {order.items.map((i, idx) => (
                  <li key={idx}>
                    {i.qty} × {i.name} — {(i.qty * i.price).toFixed(2)}
                  </li>
                ))}
              </ul>
              <p className="text-xs font-medium mt-1">
                Total: {order.total_amount} {order.currency}
              </p>
              {order.notes && <p className="text-xs text-gray-400 mt-1">Note: {order.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
