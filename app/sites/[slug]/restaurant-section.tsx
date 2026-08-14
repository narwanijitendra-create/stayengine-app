"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createFoodOrder, createTableReservation } from "./actions";
import type { Hotel, MenuItem, MenuCategory } from "@/lib/types";
import { buildMenuGroups } from "@/lib/menu";

type CartLine = { menuItemId: string; name: string; price: number; qty: number };

export default function RestaurantSection({
  hotel,
  menuItems,
  categories: menuCategories,
}: {
  hotel: Hotel;
  menuItems: MenuItem[];
  categories: MenuCategory[];
}) {
  const accent = hotel.brand_color || "#1F4E5F";

  const reservationEnabled = hotel.table_reservation_enabled;
  const anyOrderMode = hotel.room_service_enabled || hotel.delivery_enabled;

  const [view, setView] = useState<"menu" | "table">(() => {
    const hasMenuNow = menuItems.some((m) => m.is_available);
    return anyOrderMode && hasMenuNow ? "menu" : "table";
  });
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const [orderType, setOrderType] = useState<"room_service" | "delivery">(
    hotel.room_service_enabled ? "room_service" : "delivery"
  );
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<{ id: string } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [resName, setResName] = useState("");
  const [resPhone, setResPhone] = useState("");
  const [resEmail, setResEmail] = useState("");
  const [resDate, setResDate] = useState("");
  const [resTime, setResTime] = useState("19:00");
  const [resParty, setResParty] = useState(2);
  const [resNotes, setResNotes] = useState("");
  const [bookingTable, setBookingTable] = useState(false);
  const [resResult, setResResult] = useState<{ id: string } | null>(null);
  const [resError, setResError] = useState<string | null>(null);

  const available = useMemo(() => menuItems.filter((m) => m.is_available), [menuItems]);
  const orderingEnabled = anyOrderMode && available.length > 0;
  const menuGroups = useMemo(() => buildMenuGroups(available, menuCategories), [available, menuCategories]);
  // Unique top-level categories, in the order buildMenuGroups already sorted them (by sort_order).
  const topCats = useMemo(() => {
    const seen = new Set<string>();
    const list: MenuCategory[] = [];
    for (const g of menuGroups) {
      if (!seen.has(g.category.id)) {
        seen.add(g.category.id);
        list.push(g.category);
      }
    }
    return list;
  }, [menuGroups]);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (topCats.length && !activeCategory) setActiveCategory(topCats[0].id);
  }, [topCats, activeCategory]);

  useEffect(() => {
    if (view !== "menu" || topCats.length < 2) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (top) {
          const catId = top.target.getAttribute("data-category-id");
          if (catId) setActiveCategory(catId);
        }
      },
      { rootMargin: "-140px 0px -65% 0px", threshold: 0 }
    );
    const nodes = Object.values(sectionRefs.current).filter((el): el is HTMLDivElement => !!el);
    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [view, topCats]);

  function scrollToCategory(catId: string) {
    setActiveCategory(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cartLines = Object.values(cart).filter((l) => l.qty > 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const cartTotal = useMemo(() => cartLines.reduce((sum, l) => sum + l.price * l.qty, 0), [cartLines]);

  function setQty(item: MenuItem, qty: number) {
    setCart((prev) => ({
      ...prev,
      [item.id]: { menuItemId: item.id, name: item.name, price: item.price, qty: Math.max(0, qty) },
    }));
  }
  function qtyFor(id: string) {
    return cart[id]?.qty ?? 0;
  }

  async function submitOrder() {
    setOrderError(null);
    if (!hotel.room_service_enabled && !hotel.delivery_enabled) {
      setOrderError("Online ordering isn't available for this restaurant right now.");
      return;
    }
    if (cartLines.length === 0) {
      setOrderError("Add at least one item to your order.");
      return;
    }
    if (!customerName.trim() || !phone.trim()) {
      setOrderError("Name and phone are required.");
      return;
    }
    if (orderType === "room_service" && !roomNumber.trim()) {
      setOrderError("Enter your room number for room service.");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      setOrderError("Enter a delivery address.");
      return;
    }
    setPlacingOrder(true);
    const res = await createFoodOrder({
      hotelId: hotel.id,
      orderType,
      customerName: customerName.trim(),
      phone: phone.trim(),
      roomNumber: orderType === "room_service" ? roomNumber.trim() : undefined,
      deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
      items: cartLines.map((l) => ({ menu_item_id: l.menuItemId, name: l.name, price: l.price, qty: l.qty })),
      totalAmount: cartTotal,
      currency: hotel.currency || "USD",
      notes: orderNotes.trim() || undefined,
    });
    setPlacingOrder(false);
    if ("error" in res) {
      setOrderError(res.error ?? "Could not place order");
      return;
    }
    setOrderResult(res.order);
    setCart({});
    setOrderNotes("");
  }

  async function submitReservation() {
    setResError(null);
    if (!reservationEnabled) {
      setResError("Table reservations aren't available for this restaurant right now.");
      return;
    }
    if (!resName.trim() || !resPhone.trim() || !resDate || !resTime) {
      setResError("Name, phone, date and time are required.");
      return;
    }
    setBookingTable(true);
    const res = await createTableReservation({
      hotelId: hotel.id,
      guestName: resName.trim(),
      phone: resPhone.trim(),
      email: resEmail.trim() || undefined,
      reservationDate: resDate,
      reservationTime: resTime,
      partySize: resParty,
      notes: resNotes.trim() || undefined,
    });
    setBookingTable(false);
    if ("error" in res) {
      setResError(res.error ?? "Could not book a table");
      return;
    }
    setResResult(res.reservation);
  }

  if (!orderingEnabled && !reservationEnabled) return null;

  const cartPanelProps: CartPanelProps = {
    accent,
    hotel,
    cartLines,
    cartTotal,
    orderResult,
    orderError,
    placingOrder,
    orderType,
    setOrderType,
    customerName,
    setCustomerName,
    phone,
    setPhone,
    roomNumber,
    setRoomNumber,
    deliveryAddress,
    setDeliveryAddress,
    orderNotes,
    setOrderNotes,
    submitOrder,
    setOrderResult,
    setQty,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Restaurant</h1>
        <p className="text-sm text-gray-500 mt-1">
          {orderingEnabled && reservationEnabled
            ? "Order food to your room, get it delivered, or reserve a table."
            : orderingEnabled
            ? "Order food to your room or get it delivered."
            : "Reserve a table."}
        </p>
      </div>

      {orderingEnabled && reservationEnabled && (
        <div className="inline-flex bg-gray-100 rounded-full p-1 mb-6">
          <button
            onClick={() => setView("menu")}
            className={`text-sm px-5 py-2 rounded-full transition-colors ${
              view === "menu" ? "bg-white shadow-sm font-medium" : "text-gray-500"
            }`}
          >
            🍽️ Order food
          </button>
          <button
            onClick={() => setView("table")}
            className={`text-sm px-5 py-2 rounded-full transition-colors ${
              view === "table" ? "bg-white shadow-sm font-medium" : "text-gray-500"
            }`}
          >
            🪑 Book a table
          </button>
        </div>
      )}

      {view === "menu" && orderingEnabled && (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start">
          <div>
            {topCats.length > 1 && (
              <div className="sticky top-0 z-10 -mx-1 mb-6 bg-stone-50/95 backdrop-blur px-1 py-2 flex gap-2 overflow-x-auto">
                {topCats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full border transition-colors ${
                      activeCategory === cat.id
                        ? "text-white border-transparent"
                        : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"
                    }`}
                    style={activeCategory === cat.id ? { background: accent } : undefined}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {topCats.map((topCat) => (
              <div
                key={topCat.id}
                ref={(el) => {
                  sectionRefs.current[topCat.id] = el;
                }}
                data-category-id={topCat.id}
                className="mb-8 scroll-mt-24"
              >
                <p className="text-sm font-semibold text-gray-700 mb-3">{topCat.name}</p>
                {menuGroups
                  .filter((g) => g.category.id === topCat.id)
                  .map((group) => (
                    <div key={group.subcategory?.id ?? "direct"} className="mb-5 last:mb-0">
                      {group.subcategory && (
                        <p className="text-xs uppercase tracking-wide text-gray-400 mb-3 font-medium">
                          {group.subcategory.name}
                        </p>
                      )}
                      <div className="grid sm:grid-cols-2 gap-4">
                        {group.items.map((item) => {
                          const qty = qtyFor(item.id);
                          return (
                            <div
                              key={item.id}
                              className="border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                          >
                            {item.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.photo_url} alt={item.name} className="h-36 w-full object-cover" />
                            ) : (
                              <div
                                className="h-16 flex items-center justify-center text-2xl"
                                style={{ background: accent + "14" }}
                              >
                                🍽️
                              </div>
                            )}
                            <div className="p-4">
                              <p className="text-sm font-medium leading-snug flex items-center gap-2">
                                {item.is_veg !== null && (
                                  <span
                                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border flex-shrink-0 ${
                                    item.is_veg ? "border-green-600" : "border-red-500"
                                }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? "bg-green-600" : "bg-red-500"}`}
                                  />
                                </span>
                              )}
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                              )}
                              <div className="flex items-center justify-between mt-3">
                            <span className="text-sm font-medium" style={{ color: accent }}>
                              {hotel.currency} {item.price}
                            </span>
                            {qty === 0 ? (
                              <button
                                onClick={() => setQty(item, 1)}
                                className="text-xs font-medium px-3.5 py-1.5 rounded-full border"
                                style={{ borderColor: accent, color: accent }}
                              >
                                Add
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-gray-50 rounded-full px-1 py-1">
                                <button
                                  onClick={() => setQty(item, qty - 1)}
                                  className="w-6 h-6 rounded-full bg-white border border-gray-200 text-sm shadow-sm"
                                >
                                  −
                                </button>
                                <span className="text-sm w-4 text-center font-medium">{qty}</span>
                                <button
                                  onClick={() => setQty(item, qty + 1)}
                                  className="w-6 h-6 rounded-full bg-white border border-gray-200 text-sm shadow-sm"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                  ))}
              </div>
            ))}
          </div>

          <div className="hidden lg:block sticky top-24">
            <CartPanel {...cartPanelProps} />
          </div>

          {cartCount > 0 && !cartOpen && !orderResult && (
            <button
              onClick={() => setCartOpen(true)}
              className="lg:hidden fixed bottom-4 left-4 right-4 z-20 rounded-full text-white text-sm font-medium py-3.5 px-5 shadow-lg flex items-center justify-between"
              style={{ background: accent }}
            >
              <span>
                🛒 {cartCount} item{cartCount > 1 ? "s" : ""}
              </span>
              <span>
                {hotel.currency} {cartTotal.toFixed(2)} · View order →
              </span>
            </button>
          )}

          {cartOpen && (
            <div className="lg:hidden fixed inset-0 z-30 flex items-end">
              <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
              <div className="relative bg-white w-full rounded-t-2xl max-h-[85vh] overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium">Your order</p>
                  <button onClick={() => setCartOpen(false)} className="text-xs text-gray-400">
                    Close
                  </button>
                </div>
                <CartPanel {...cartPanelProps} />
              </div>
            </div>
          )}
        </div>
      )}

      {view === "table" && reservationEnabled && (
        <div className="max-w-lg">
          <div className="border border-gray-200 rounded-2xl bg-white shadow-sm p-6">
            {resResult ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-medium mb-1">Table requested!</p>
                <p className="text-sm text-gray-500">
                  Reservation #{resResult.id.slice(0, 8)} — the hotel will confirm it shortly.
                </p>
                <button onClick={() => setResResult(null)} className="mt-4 text-xs underline text-gray-500">
                  Book another table
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium mb-4">Reserve a table</p>
                <div className="space-y-3">
                  <input
                    placeholder="Your name"
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Phone"
                      value={resPhone}
                      onChange={(e) => setResPhone(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm"
                    />
                    <input
                      placeholder="Email (optional)"
                      value={resEmail}
                      onChange={(e) => setResEmail(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="date"
                      value={resDate}
                      onChange={(e) => setResDate(e.target.value)}
                      className="col-span-2 border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm"
                    />
                    <input
                      type="time"
                      value={resTime}
                      onChange={(e) => setResTime(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Party size</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setResParty(Math.max(1, resParty - 1))}
                        className="w-8 h-8 rounded-full border border-gray-300 text-sm"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{resParty}</span>
                      <button onClick={() => setResParty(resParty + 1)} className="w-8 h-8 rounded-full border border-gray-300 text-sm">
                        +
                      </button>
                    </div>
                  </div>
                  <textarea
                    placeholder="Notes (optional)"
                    value={resNotes}
                    onChange={(e) => setResNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm"
                  />
                </div>
                {resError && <p className="text-xs text-red-500 mt-3">{resError}</p>}
                <button
                  onClick={submitReservation}
                  disabled={bookingTable}
                  className="mt-4 w-full text-white text-sm rounded-lg py-2.5 disabled:opacity-50 font-medium"
                  style={{ background: accent }}
                >
                  {bookingTable ? "Booking..." : "Request table"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type CartPanelProps = {
  accent: string;
  hotel: Hotel;
  cartLines: CartLine[];
  cartTotal: number;
  orderResult: { id: string } | null;
  orderError: string | null;
  placingOrder: boolean;
  orderType: "room_service" | "delivery";
  setOrderType: (t: "room_service" | "delivery") => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  roomNumber: string;
  setRoomNumber: (v: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;
  orderNotes: string;
  setOrderNotes: (v: string) => void;
  submitOrder: () => void;
  setOrderResult: (v: { id: string } | null) => void;
  setQty: (item: MenuItem, qty: number) => void;
};

function CartPanel({
  accent,
  hotel,
  cartLines,
  cartTotal,
  orderResult,
  orderError,
  placingOrder,
  orderType,
  setOrderType,
  customerName,
  setCustomerName,
  phone,
  setPhone,
  roomNumber,
  setRoomNumber,
  deliveryAddress,
  setDeliveryAddress,
  orderNotes,
  setOrderNotes,
  submitOrder,
  setOrderResult,
}: CartPanelProps) {
  return (
    <div className="border border-gray-200 rounded-2xl bg-white shadow-sm p-4">
      {orderResult ? (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-medium mb-1">Order placed!</p>
          <p className="text-sm text-gray-500">
            Order #{orderResult.id.slice(0, 8)} — the hotel will confirm it shortly.
          </p>
          <button onClick={() => setOrderResult(null)} className="mt-4 text-xs underline text-gray-500">
            Place another order
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium mb-3">Your order</p>
          {cartLines.length === 0 ? (
            <p className="text-xs text-gray-400 mb-3">No items yet — add something from the menu.</p>
          ) : (
            <ul className="text-xs space-y-1.5 mb-3">
              {cartLines.map((l) => (
                <li key={l.menuItemId} className="flex justify-between">
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <span className="text-gray-600">
                    {hotel.currency} {(l.qty * l.price).toFixed(2)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between font-medium pt-1.5 border-t border-gray-100">
                <span>Total</span>
                <span>
                  {hotel.currency} {cartTotal.toFixed(2)}
                </span>
              </li>
            </ul>
          )}

          {hotel.room_service_enabled && hotel.delivery_enabled && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setOrderType("room_service")}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  orderType === "room_service" ? "text-white border-transparent" : "border-gray-300"
                }`}
                style={orderType === "room_service" ? { background: accent } : undefined}
              >
                Room service
              </button>
              <button
                onClick={() => setOrderType("delivery")}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  orderType === "delivery" ? "text-white border-transparent" : "border-gray-300"
                }`}
                style={orderType === "delivery" ? { background: accent } : undefined}
              >
                Delivery
              </button>
            </div>
          )}

          <div className="space-y-2">
            <input
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            {orderType === "room_service" ? (
              <input
                placeholder="Room number"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            ) : (
              <input
                placeholder="Delivery address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            )}
            <textarea
              placeholder="Notes (optional)"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {orderError && <p className="text-xs text-red-500 mt-2">{orderError}</p>}
          <button
            onClick={submitOrder}
            disabled={placingOrder}
            className="mt-3 w-full text-white text-sm rounded-md py-2 disabled:opacity-50 font-medium"
            style={{ background: accent }}
          >
            {placingOrder ? "Placing order..." : "Place order"}
          </button>
        </>
      )}
    </div>
  );
}
