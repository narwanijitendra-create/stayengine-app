"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { MenuItem, TableReservation, FoodOrder } from "@/lib/types";

export default function RestaurantTab({ hotelId }: { hotelId: string }) {
  const [subTab, setSubTab] = useState<"menu" | "orders" | "reservations">("menu");

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
      <h2 className="text-base font-medium mb-4">Restaurant</h2>
      <div className="flex gap-2 mb-5">
        {(
          [
            { key: "menu", label: "Menu" },
            { key: "orders", label: "Orders" },
            { key: "reservations", label: "Table reservations" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`text-sm px-3 py-1.5 rounded-md border ${
              subTab === t.key
                ? "bg-black text-white border-black"
                : "border-gray-300 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === "menu" && <MenuManager hotelId={hotelId} />}
      {subTab === "orders" && <OrdersManager hotelId={hotelId} />}
      {subTab === "reservations" && <ReservationsManager hotelId={hotelId} />}
    </div>
  );
}

const EMPTY_ITEM_FORM = {
  category: "Main Course",
  name: "",
  description: "",
  price: "",
  photo_url: "",
  is_veg: "" as "" | "true" | "false",
};

function MenuManager({ hotelId }: { hotelId: string }) {
  const supabase = createBrowserClient();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    setItems((data as MenuItem[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      category: item.category,
      name: item.name,
      description: item.description || "",
      price: String(item.price),
      photo_url: item.photo_url || "",
      is_veg: item.is_veg === null ? "" : item.is_veg ? "true" : "false",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_ITEM_FORM);
  }

  async function saveItem() {
    if (!form.name.trim() || !form.price.trim()) {
      setError("Name and price are required.");
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      hotel_id: hotelId,
      category: form.category.trim() || "Main Course",
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price) || 0,
      photo_url: form.photo_url.trim() || null,
      is_veg: form.is_veg === "" ? null : form.is_veg === "true",
    };
    if (editingId) {
      await supabase.from("menu_items").update(payload).eq("id", editingId);
    } else {
      await supabase.from("menu_items").insert(payload);
    }
    setSaving(false);
    resetForm();
    loadItems();
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    loadItems();
  }

  async function deleteItem(id: string) {
    await supabase.from("menu_items").delete().eq("id", id);
    loadItems();
  }

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div>
      <div className="border border-gray-200 rounded-xl p-4 mb-5">
        <p className="text-sm font-medium mb-3">{editingId ? "Edit menu item" : "Add a menu item"}</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            placeholder="Item name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Category, e.g. Starters"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={form.is_veg}
            onChange={(e) => setForm({ ...form, is_veg: e.target.value as "" | "true" | "false" })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Veg / Non-veg (optional)</option>
            <option value="true">Veg</option>
            <option value="false">Non-veg</option>
          </select>
          <input
            placeholder="Photo URL (optional)"
            value={form.photo_url}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button
            onClick={saveItem}
            disabled={saving}
            className="text-sm bg-black text-white rounded-md px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add item"}
          </button>
          {editingId && (
            <button onClick={resetForm} className="text-sm border border-gray-300 rounded-md px-4 py-2">
              Cancel
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading menu...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">No menu items yet.</p>
      ) : (
        Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="mb-5">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{category}</p>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {categoryItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${!item.is_available ? "text-gray-400 line-through" : ""}`}>
                      {item.name}
                      {item.is_veg !== null && (
                        <span className={`ml-2 text-[10px] ${item.is_veg ? "text-green-600" : "text-red-500"}`}>
                          {item.is_veg ? "VEG" : "NON-VEG"}
                        </span>
                      )}
                    </p>
                    {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm">{item.price}</span>
                    <button onClick={() => toggleAvailable(item)} className="text-xs underline text-gray-500">
                      {item.is_available ? "Mark unavailable" : "Mark available"}
                    </button>
                    <button onClick={() => startEdit(item)} className="text-xs underline text-gray-500">
                      Edit
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="text-xs underline text-red-500">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const ORDER_STATUSES: FoodOrder["status"][] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

function OrdersManager({ hotelId }: { hotelId: string }) {
  const supabase = createBrowserClient();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from("food_orders")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });
    setOrders((data as FoodOrder[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function updateStatus(id: string, status: FoodOrder["status"]) {
    await supabase.from("food_orders").update({ status }).eq("id", id);
    loadOrders();
  }

  if (loading) return <p className="text-sm text-gray-400">Loading orders...</p>;
  if (orders.length === 0) return <p className="text-sm text-gray-400">No food orders yet.</p>;

  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
      {orders.map((order) => (
        <div key={order.id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium">
                {order.customer_name} · {order.phone}
              </p>
              <p className="text-xs text-gray-400">
                {order.order_type === "room_service"
                  ? `Room service${order.room_number ? ` — Room ${order.room_number}` : ""}`
                  : order.order_type === "delivery"
                  ? `Delivery — ${order.delivery_address || "no address"}`
                  : "Dine-in"}{" "}
                · {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
            <select
              value={order.status}
              onChange={(e) => updateStatus(order.id, e.target.value as FoodOrder["status"])}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            >
              {ORDER_STATUSES.map((s) => (
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
  );
}

const RESERVATION_STATUSES: TableReservation["status"][] = ["pending", "confirmed", "cancelled", "completed"];

function ReservationsManager({ hotelId }: { hotelId: string }) {
  const supabase = createBrowserClient();
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadReservations() {
    setLoading(true);
    const { data } = await supabase
      .from("table_reservations")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("reservation_date", { ascending: true });
    setReservations((data as TableReservation[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function updateStatus(id: string, status: TableReservation["status"]) {
    await supabase.from("table_reservations").update({ status }).eq("id", id);
    loadReservations();
  }

  if (loading) return <p className="text-sm text-gray-400">Loading reservations...</p>;
  if (reservations.length === 0) return <p className="text-sm text-gray-400">No table reservations yet.</p>;

  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
      {reservations.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
          <div>
            <p className="text-sm font-medium">
              {r.guest_name} · {r.phone}
            </p>
            <p className="text-xs text-gray-400">
              {r.reservation_date} at {r.reservation_time} · Party of {r.party_size}
            </p>
            {r.notes && <p className="text-xs text-gray-400">Note: {r.notes}</p>}
          </div>
          <select
            value={r.status}
            onChange={(e) => updateStatus(r.id, e.target.value as TableReservation["status"])}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs"
          >
            {RESERVATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
