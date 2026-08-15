"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { MenuItem, MenuCategory, TableReservation, FoodOrder } from "@/lib/types";
import { buildMenuGroups } from "@/lib/menu";
import { STOCK_FOOD_PHOTOS } from "@/lib/stock-food-photos";

export default function RestaurantTab({ hotelId }: { hotelId: string }) {
  const [subTab, setSubTab] = useState<"menu" | "orders" | "reservations" | "settings">("menu");

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
      <h2 className="text-base font-medium mb-4">Restaurant</h2>
      <div className="flex gap-2 mb-5 flex-wrap">
        {(
          [
            { key: "menu", label: "Menu" },
            { key: "orders", label: "Orders" },
            { key: "reservations", label: "Table reservations" },
            { key: "settings", label: "Settings" },
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
      {subTab === "settings" && <SettingsManager hotelId={hotelId} />}
    </div>
  );
}

type ServiceFlags = {
  table_reservation_enabled: boolean;
  room_service_enabled: boolean;
  delivery_enabled: boolean;
  order_email_notifications_enabled: boolean;
  contact_email: string | null;
};

function SettingsManager({ hotelId }: { hotelId: string }) {
  const supabase = createBrowserClient();
  const [flags, setFlags] = useState<ServiceFlags | null>(null);
  const [busyField, setBusyField] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("hotels")
      .select(
        "table_reservation_enabled, room_service_enabled, delivery_enabled, order_email_notifications_enabled, contact_email"
      )
      .eq("id", hotelId)
      .single();
    setFlags(data as ServiceFlags);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function toggle(field: "table_reservation_enabled" | "room_service_enabled" | "delivery_enabled" | "order_email_notifications_enabled") {
    if (!flags) return;
    setBusyField(field);
    const next = !flags[field];
    await supabase.from("hotels").update({ [field]: next }).eq("id", hotelId);
    setFlags({ ...flags, [field]: next });
    setBusyField(null);
  }

  if (!flags) return <p className="text-sm text-gray-400">Loading settings...</p>;

  const rows: { field: "table_reservation_enabled" | "room_service_enabled" | "delivery_enabled"; label: string; hint: string }[] = [
    {
      field: "table_reservation_enabled",
      label: "Table reservations",
      hint: "Let guests request a table booking from the restaurant page.",
    },
    {
      field: "room_service_enabled",
      label: "Room service orders",
      hint: "Let guests order food delivered to their room.",
    },
    {
      field: "delivery_enabled",
      label: "Delivery orders",
      hint: "Let guests order food delivered to an outside address.",
    },
  ];

  return (
    <div className="space-y-3 max-w-lg">
      <p className="text-xs text-gray-400 mb-1">
        Turn individual restaurant features on or off. Guests will only see the options you enable here.
      </p>
      {rows.map((r) => (
        <div key={r.field} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium">{r.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{r.hint}</p>
          </div>
          <button
            disabled={busyField === r.field}
            onClick={() => toggle(r.field)}
            className={`text-xs rounded-full px-3 py-1 border disabled:opacity-50 whitespace-nowrap ${
              flags[r.field] ? "bg-green-50 text-green-800 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"
            }`}
          >
            {flags[r.field] ? "On" : "Off"}
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium">Email me on new orders</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {flags.contact_email
              ? `Sends a notification to ${flags.contact_email} for new room service and delivery orders.`
              : "Add a contact email under Hotel profile first — notifications need somewhere to send to."}
          </p>
        </div>
        <button
          disabled={busyField === "order_email_notifications_enabled" || !flags.contact_email}
          onClick={() => toggle("order_email_notifications_enabled")}
          className={`text-xs rounded-full px-3 py-1 border disabled:opacity-50 whitespace-nowrap ${
            flags.order_email_notifications_enabled
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-gray-50 text-gray-400 border-gray-200"
          }`}
        >
          {flags.order_email_notifications_enabled ? "On" : "Off"}
        </button>
      </div>
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
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  async function handlePhotoUpload(file: File | null) {
    if (!file) return;
    setPhotoUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${hotelId}/menu/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("hotel-media").upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("hotel-media").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
    }
    setPhotoUploading(false);
  }

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

  function moveItem(groupItems: MenuItem[], itemId: string, direction: "up" | "down") {
    const idx = groupItems.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= groupItems.length) return;
    const list = [...groupItems];
    [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
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
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center gap-2">
                {form.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.photo_url}
                    alt=""
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-gray-200"
                  />
                )}
                <input
                  placeholder="Photo URL (optional)"
                  value={form.photo_url}
                  onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs border border-gray-300 rounded-md px-3 py-2 whitespace-nowrap cursor-pointer">
                  {photoUploading ? "Uploading..." : "Upload photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={photoUploading}
                    onChange={(e) => handlePhotoUpload(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowStockPicker(true)}
                  className="text-xs border border-gray-300 rounded-md px-3 py-2 whitespace-nowrap"
                >
                  Choose stock photo
                </button>
              </div>
            </div>
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
              {group.items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex flex-col shrink-0">
                    <button
                      onClick={() => moveItem(group.items, item.id, "up")}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-[10px] px-0.5"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveItem(group.items, item.id, "down")}
                      disabled={idx === group.items.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-[10px] px-0.5"
                    >
                      ▼
                    </button>
                  </div>
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

      {showStockPicker && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setShowStockPicker(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Choose a stock photo</p>
              <button onClick={() => setShowStockPicker(false)} className="text-xs text-gray-500 underline">
                Close
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Free stock photos — pick one if you don&apos;t have your own image for this item.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {STOCK_FOOD_PHOTOS.map((p) => (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, photo_url: p.url }));
                    setShowStockPicker(false);
                  }}
                  className="text-left group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.label}
                    className="w-full h-20 object-cover rounded-lg border border-gray-200 group-hover:opacity-80"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 truncate">{p.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
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

  function moveTop(id: string, direction: "up" | "down") {
    const idx = topCats.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= topCats.length) return;
    const list = [...topCats];
    [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
    persistOrder(list);
  }

  function moveSub(parentId: string, id: string, direction: "up" | "down") {
    const subs = subsOf(parentId);
    const idx = subs.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= subs.length) return;
    const list = [...subs];
    [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
    persistOrder(list);
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 mb-5">
      <p className="text-sm font-medium mb-1">Categories</p>
      <p className="text-xs text-gray-400 mb-3">Use ▲▼ to reorder. Click a name to rename it.</p>

      {topCats.length > 0 && (
        <div className="space-y-2 mb-3">
          {topCats.map((cat, catIdx) => (
            <div key={cat.id}>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => moveTop(cat.id, "up")}
                    disabled={catIdx === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-[10px] px-0.5"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveTop(cat.id, "down")}
                    disabled={catIdx === topCats.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-[10px] px-0.5"
                    aria-label="Move down"
                >
                    ▼
                  </button>
                </div>
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
                {subsOf(cat.id).map((sub, subIdx) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-1.5"
          >
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => moveSub(cat.id, sub.id, "up")}
                        disabled={subIdx === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-[9px] px-0.5"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveSub(cat.id, sub.id, "down")}
                        disabled={subIdx === subsOf(cat.id).length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-[9px] px-0.5"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>
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
  "ready",
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

  // Dine-in orders that are still open (not delivered/cancelled), grouped by
  // table, so the owner can see at a glance which tables have running orders
  // that haven't been closed out yet.
  const runningTables: { tableNumber: string; orders: FoodOrder[] }[] = [];
  {
    const byTable = new Map<string, FoodOrder[]>();
    for (const o of orders) {
      if (o.order_type !== "dine_in") continue;
      if (o.status === "delivered" || o.status === "cancelled") continue;
      const key = o.table_number || "—";
      if (!byTable.has(key)) byTable.set(key, []);
      byTable.get(key)!.push(o);
    }
    for (const [tableNumber, tableOrders] of byTable) {
      runningTables.push({ tableNumber, orders: tableOrders });
    }
    runningTables.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
  }

  if (orders.length === 0) return <p className="text-sm text-gray-400">No food orders yet.</p>;

  return (
    <div>
      {runningTables.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-medium mb-2">Running tables</p>
          <p className="text-xs text-gray-400 mb-2">
            Dine-in tables with orders placed but not yet closed by the waiter.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {runningTables.map((g) => {
              const total = g.orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
              return (
                <div key={g.tableNumber} className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
                  <p className="text-sm font-medium">Table {g.tableNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {g.orders.length} open order{g.orders.length > 1 ? "s" : ""} · Total{" "}
                    {total.toFixed(2)} {g.orders[0].currency}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
