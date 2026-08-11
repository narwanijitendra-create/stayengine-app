"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { MenuItem, MenuCategory, TableReservation, FoodOrder } from "@/lib/types";
import { buildMenuGroups } from "@/lib/menu";

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
  categoryId: "",
  subcategoryId: "",
  name: "",
  description: "",
  price: "",
  photo_url: "",
  is_veg: "" as "" | "true" | "false",
};

function MenuManager({ hotelId }: { hotelId: string }) {
  const supabase = createBrowserClient();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemDragId, setItemDragId] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [{ data: itemsData }, { data: catsData }] = await Promise.all([
      supabase.from("menu_items").select("*").eq("hotel_id", hotelId).order("sort_order", { ascending: true }),
      supabase.from("menu_categories").select("*").eq("hotel_id", hotelId).order("sort_order", { ascending: true }),
    ]);
    setItems((itemsData as MenuItem[]) || []);
    setCategories((catsData as MenuCategory[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const topCategories = categories.filter((c) => c.parent_id === null).sort((a, b) => a.sort_order - b.sort_order);
  function subcategoriesOf(parentId: string) {
    return categories.filter((c) => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    const cat = categories.find((c) => c.id === item.category_id);
    const isSubcat = !!cat?.parent_id;
    setForm({
      categoryId: isSubcat ? (cat!.parent_id as string) : cat?.id ?? "",
      subcategoryId: isSubcat ? cat!.id : "",
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
    if (!form.categoryId) {
      setError("Choose a category.");
      return;
    }
    setError(null);
    setSaving(true);
    const categoryId = form.subcategoryId || form.categoryId;
    const categoryName = categories.find((c) => c.id === categoryId)?.name || "Uncategorized";
    const payload = {
      hotel_id: hotelId,
      category_id: categoryId,
      category: categoryName,
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
    loadAll();
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    loadAll();
  }

  async function deleteItem(id: string) {
    await supabase.from("menu_items").delete().eq("id", id);
    loadAll();
  }

  async function persistItemOrder(list: MenuItem[]) {
    await Promise.all(list.map((it, idx) => supabase.from("menu_items").update({ sort_order: idx }).eq("id", it.id)));
    loadAll();
  }

  function handleItemDrop(groupItems: MenuItem[], targetId: string) {
    if (!itemDragId || itemDragId === targetId) return;
    const list = [...groupItems];
    const fromIdx = list.findIndex((i) => i.id === itemDragId);
    const toIdx = list.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setItemDragId(null);
    persistItemOrder(list);
  }

  const groups = buildMenuGroups(items, categories);

  return (
    <div>
      <CategoryManager hotelId={hotelId} categories={categories} onChange={loadAll} />

      <div className="border border-gray-200 rounded-xl p-4 mb-5">
        <p className="text-sm font-medium mb-3">{editingId ? "Edit menu item" : "Add a menu item"}</p>
        {topCategories.length === 0 ? (
          <p className="text-xs text-gray-400 mb-2">Create a category above first, then add items to it.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              placeholder="Item name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value, subcategoryId: "" })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Choose a category</option>
              {topCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={form.subcategoryId}
              onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
              disabled={!form.categoryId}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">No subcategory</option>
              {form.categoryId &&
                subcategoriesOf(form.categoryId).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
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
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button
            onClick={saveItem}
            disabled={saving || topCategories.length === 0}
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
        groups.map((group) => (
          <div key={`${group.category.id}-${group.subcategory?.id ?? "none"}`} className="mb-5">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              {group.category.name}
              {group.subcategory ? ` / ${group.subcategory.name}` : ""}
            </p>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setItemDragId(item.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleItemDrop(group.items, item.id)}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="text-gray-300 cursor-grab select-none">⠿</span>
                  <div className="min-w-0 flex-1">
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

function CategoryManager({
  hotelId,
  categories,
  onChange,
}: {
  hotelId: string;
  categories: MenuCategory[];
  onChange: () => void;
}) {
  const supabase = createBrowserClient();
  const [newCatName, setNewCatName] = useState("");
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const topCats = categories.filter((c) => c.parent_id === null).sort((a, b) => a.sort_order - b.sort_order);
  function subsOf(id: string) {
    return categories.filter((c) => c.parent_id === id).sort((a, b) => a.sort_order - b.sort_order);
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    setBusy(true);
    await supabase
      .from("menu_categories")
      .insert({ hotel_id: hotelId, name: newCatName.trim(), parent_id: null, sort_order: topCats.length });
    setNewCatName("");
    setBusy(false);
    onChange();
  }

  async function addSubcategory(parentId: string) {
    if (!newSubName.trim()) return;
    setBusy(true);
    await supabase
      .from("menu_categories")
      .insert({ hotel_id: hotelId, name: newSubName.trim(), parent_id: parentId, sort_order: subsOf(parentId).length });
    setNewSubName("");
    setAddingSubFor(null);
    setBusy(false);
    onChange();
  }

  async function renameCategory(id: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    setBusy(true);
    await supabase.from("menu_categories").update({ name: renameValue.trim() }).eq("id", id);
    setRenamingId(null);
    setBusy(false);
    onChange();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category? Subcategories and item assignments under it will also be affected.")) return;
    setBusy(true);
    await supabase.from("menu_categories").delete().eq("id", id);
    setBusy(false);
    onChange();
  }

  async function persistOrder(list: MenuCategory[]) {
    setBusy(true);
    await Promise.all(list.map((c, idx) => supabase.from("menu_categories").update({ sort_order: idx }).eq("id", c.id)));
    setBusy(false);
    onChange();
  }

  function handleDropTop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...topCats];
    const fromIdx = list.findIndex((c) => c.id === dragId);
    const toIdx = list.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setDragId(null);
    persistOrder(list);
  }

  function handleDropSub(parentId: string, targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...subsOf(parentId)];
    const fromIdx = list.findIndex((c) => c.id === dragId);
    const toIdx = list.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setDragId(null);
    persistOrder(list);
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 mb-5">
      <p className="text-sm font-medium mb-1">Categories</p>
      <p className="text-xs text-gray-400 mb-3">Drag ⠿ to reorder. Click a name to rename it.</p>

      {topCats.length > 0 && (
        <div className="space-y-2 mb-3">
          {topCats.map((cat) => (
            <div key={cat.id}>
              <div
                draggable
                onDragStart={() => setDragId(cat.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropTop(cat.id)}
                className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
              >
                <span className="text-gray-300 cursor-grab select-none">⠿</span>
                {renamingId === cat.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => renameCategory(cat.id)}
                    onKeyDown={(e) => e.key === "Enter" && renameCategory(cat.id)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm font-medium cursor-pointer"
                    onClick={() => {
                      setRenamingId(cat.id);
                      setRenameValue(cat.name);
                    }}
                  >
                    {cat.name}
                  </span>
                )}
                <button
                  onClick={() => setAddingSubFor(addingSubFor === cat.id ? null : cat.id)}
                  className="text-xs underline text-gray-500 whitespace-nowrap"
                >
                  + Subcategory
                </button>
                <button onClick={() => deleteCategory(cat.id)} className="text-xs underline text-red-500">
                  Delete
                </button>
              </div>

              <div className="ml-6 mt-1 space-y-1">
                {subsOf(cat.id).map((sub) => (
                  <div
                    key={sub.id}
                    draggable
                    onDragStart={() => setDragId(sub.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropSub(cat.id, sub.id)}
                    className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-1.5"
                  >
                    <span className="text-gray-300 cursor-grab select-none">⠿</span>
                    {renamingId === sub.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameCategory(sub.id)}
                        onKeyDown={(e) => e.key === "Enter" && renameCategory(sub.id)}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs cursor-pointer"
                        onClick={() => {
                          setRenamingId(sub.id);
                          setRenameValue(sub.name);
                        }}
                      >
                        {sub.name}
                      </span>
                    )}
                    <button onClick={() => deleteCategory(sub.id)} className="text-xs underline text-red-500">
                      Delete
                    </button>
                  </div>
                ))}
                {addingSubFor === cat.id && (
                  <div className="flex gap-2 mt-1">
                    <input
                      autoFocus
                      placeholder="Subcategory name"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSubcategory(cat.id)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => addSubcategory(cat.id)}
                      disabled={busy}
                      className="text-xs bg-black text-white rounded px-2 py-1 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          placeholder="New category name, e.g. Starters"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={addCategory}
          disabled={busy}
          className="text-sm bg-black text-white rounded-md px-4 py-2 disabled:opacity-50 whitespace-nowrap"
        >
          Add category
        </button>
      </div>
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
