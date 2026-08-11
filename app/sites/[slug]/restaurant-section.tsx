"use client";

import { useMemo, useState } from "react";
import { createFoodOrder, createTableReservation } from "./actions";
import type { Hotel, MenuItem } from "@/lib/types";

type CartLine = { menuItemId: string; name: string; price: number; qty: number };

export default function RestaurantSection({ hotel, menuItems }: { hotel: Hotel; menuItems: MenuItem[] }) {
  const [view, setView] = useState<"menu" | "table">("menu");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [orderType, setOrderType] = useState<"room_service" | "delivery">("room_service");
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

  const available = menuItems.filter((m) => m.is_available);
  const grouped = available.reduce<Record<string, MenuItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const cartLines = Object.values(cart).filter((l) => l.qty > 0);
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

  if (available.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium mb-3">Restaurant</h2>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView("menu")}
          className={`text-sm px-3 py-1.5 rounded-full border ${
            view === "menu" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
          }`}
        >
          Order food
        </button>
        <button
          onClick={() => setView("table")}
          className={`text-sm px-3 py-1.5 rounded-full border ${
            view === "table" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
          }`}
        >
          Book a table
        </button>
      </div>

      {view === "menu" && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{category}</p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {item.name}
                          {item.is_veg !== null && (
                            <span className={`ml-2 text-[10px] ${item.is_veg ? "text-green-600" : "text-red-500"}`}>
                              {item.is_veg ? "VEG" : "NON-VEG"}
                            </span>
                          )}
                        </p>
                        {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                        <p className="text-xs text-gray-600 mt-0.5">
                          {hotel.currency} {item.price}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setQty(item, qtyFor(item.id) - 1)}
                          className="w-6 h-6 rounded-full border border-gray-300 text-sm"
                        >
                          −
                        </button>
                        <span className="text-sm w-4 text-center">{qtyFor(item.id)}</span>
                        <button
                          onClick={() => setQty(item, qtyFor(item.id) + 1)}
                          className="w-6 h-6 rounded-full border border-gray-300 text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-2xl bg-white p-4 h-fit sticky top-4">
            {orderResult ? (
              <div className="text-sm">
                <p className="font-medium mb-1">Order placed!</p>
                <p className="text-gray-500 text-xs">
                  Order #{orderResult.id.slice(0, 8)} — the hotel will confirm it shortly.
                </p>
                <button onClick={() => setOrderResult(null)} className="mt-3 text-xs underline text-gray-500">
                  Place another order
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium mb-3">Your order</p>
                {cartLines.length === 0 ? (
                  <p className="text-xs text-gray-400 mb-3">No items yet — add something from the menu.</p>
                ) : (
                  <ul className="text-xs space-y-1 mb-3">
                    {cartLines.map((l) => (
                      <li key={l.menuItemId} className="flex justify-between">
                        <span>
                          {l.qty} × {l.name}
                        </span>
                        <span>
                          {hotel.currency} {(l.qty * l.price).toFixed(2)}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between font-medium pt-1 border-t border-gray-100">
                      <span>Total</span>
                      <span>
                        {hotel.currency} {cartTotal.toFixed(2)}
                      </span>
                    </li>
                  </ul>
                )}

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setOrderType("room_service")}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      orderType === "room_service" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"
                    }`}
                  >
                    Room service
                  </button>
                  <button
                    onClick={() => setOrderType("delivery")}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      orderType === "delivery" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"
                    }`}
                  >
                    Delivery
                  </button>
                </div>

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
                  className="mt-3 w-full bg-gray-900 text-white text-sm rounded-md py-2 disabled:opacity-50"
                >
                  {placingOrder ? "Placing order..." : "Place order"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {view === "table" && (
        <div className="max-w-md border border-gray-200 rounded-2xl bg-white p-4">
          {resResult ? (
            <div className="text-sm">
              <p className="font-medium mb-1">Table requested!</p>
              <p className="text-gray-500 text-xs">
                Reservation #{resResult.id.slice(0, 8)} — the hotel will confirm it shortly.
              </p>
              <button onClick={() => setResResult(null)} className="mt-3 text-xs underline text-gray-500">
                Book another table
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium mb-3">Reserve a table</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Your name"
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  className="col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Phone"
                  value={resPhone}
                  onChange={(e) => setResPhone(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Email (optional)"
                  value={resEmail}
                  onChange={(e) => setResEmail(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={resDate}
                  onChange={(e) => setResDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={resTime}
                  onChange={(e) => setResTime(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Party size"
                  value={resParty}
                  onChange={(e) => setResParty(Number(e.target.value) || 1)}
                  className="col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  rows={2}
                  className="col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              {resError && <p className="text-xs text-red-500 mt-2">{resError}</p>}
              <button
                onClick={submitReservation}
                disabled={bookingTable}
                className="mt-3 w-full bg-gray-900 text-white text-sm rounded-md py-2 disabled:opacity-50"
              >
                {bookingTable ? "Booking..." : "Request table"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
