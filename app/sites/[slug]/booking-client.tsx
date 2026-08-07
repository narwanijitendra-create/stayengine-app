"use client";

import { useMemo, useState } from "react";
import { createBooking } from "./actions";
import type { Hotel, RoomType } from "@/lib/types";

function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export default function BookingClient({
  hotel,
  roomTypes,
  embedded = false,
}: {
  hotel: Hotel;
  roomTypes: RoomType[];
  embedded?: boolean;
}) {
  const today = new Date();
  const inDefault = today.toISOString().slice(0, 10);
  const outDefault = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState(inDefault);
  const [checkOut, setCheckOut] = useState(outDefault);
  const [guestsCount, setGuestsCount] = useState(2);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [step, setStep] = useState<"search" | "checkout" | "confirmed">("search");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const subtotal = selectedRoom ? selectedRoom.base_price * nights : 0;
  const taxes = Math.round(subtotal * 0.12 * 100) / 100;
  const total = subtotal + taxes;

  async function handleConfirm() {
    if (!selectedRoom) return;
    setLoading(true);
    setError(null);
    const res = await createBooking({
      hotelId: hotel.id,
      roomTypeId: selectedRoom.id,
      checkIn,
      checkOut,
      guestsCount,
      totalAmount: total,
      currency: hotel.currency,
      guestName: form.name,
      guestEmail: form.email,
      guestPhone: form.phone,
      source: embedded ? "widget" : "direct",
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStep("confirmed");
  }

  const accent = hotel.brand_color || "#1F4E5F";

  return (
    <div className={embedded ? "p-4" : "max-w-3xl mx-auto px-6 py-10"}>
      {!embedded && (
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-medium"
            style={{ background: accent }}
          >
            {hotel.name.slice(0, 1)}
          </div>
          <div>
            <p className="font-medium">{hotel.name}</p>
            <p className="text-xs text-gray-500">Direct booking</p>
          </div>
        </div>
      )}

      {step === "search" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Guests</label>
                <select
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                >
                  <option value={1}>1 adult</option>
                  <option value={2}>2 adults</option>
                  <option value={3}>2 adults, 1 child</option>
                  <option value={4}>4 guests</option>
                </select>
              </div>
            </div>
            {nights === 0 && (
              <p className="text-xs text-red-600 mt-2">Check-out must be after check-in.</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {roomTypes.map((rt) => (
              <div key={rt.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="h-16" style={{ background: accent + "22" }} />
                <div className="p-4">
                  <p className="font-medium text-sm">{rt.name}</p>
                  <p className="text-xs text-gray-500 mb-3">{rt.description}</p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">
                      {hotel.currency} {rt.base_price}
                      <span className="text-xs text-gray-400 font-normal"> /night</span>
                    </span>
                    <button
                      disabled={nights === 0 || rt.max_occupancy < 1}
                      onClick={() => {
                        setSelectedRoom(rt);
                        setStep("checkout");
                      }}
                      className="text-xs border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Select
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === "checkout" && selectedRoom && (
        <div className="border border-gray-200 rounded-xl p-5 bg-white">
          <button className="text-xs text-gray-500 mb-4" onClick={() => setStep("search")}>
            ← Back
          </button>
          <p className="text-sm font-medium text-gray-600 mb-3">Booking summary</p>
          <div className="text-sm flex justify-between mb-1">
            <span>{selectedRoom.name} x {nights} nights</span>
            <span>{hotel.currency} {subtotal.toFixed(2)}</span>
          </div>
          <div className="text-sm flex justify-between text-gray-500 mb-2">
            <span>Taxes and fees</span>
            <span>{hotel.currency} {taxes.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium border-t border-gray-200 pt-2 mb-4">
            <span>Total</span>
            <span>{hotel.currency} {total.toFixed(2)}</span>
          </div>

          <div className="space-y-2 mb-4">
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

          <button
            disabled={loading || !form.name || !form.email}
            onClick={handleConfirm}
            className="w-full rounded-md py-2 text-sm text-white disabled:opacity-40"
            style={{ background: accent }}
          >
            {loading ? "Booking..." : "Confirm and pay"}
          </button>
          <p className="text-[11px] text-gray-400 mt-2">
            Payment is a placeholder in this MVP — wire up Stripe Connect here before going live.
          </p>
        </div>
      )}

      {step === "confirmed" && (
        <div className="border border-gray-200 rounded-xl p-6 bg-white text-center">
          <p className="text-lg font-medium mb-1">Booking confirmed</p>
          <p className="text-sm text-gray-500">
            A confirmation has been sent to {form.email}. See you at {hotel.name}.
          </p>
        </div>
      )}
    </div>
  );
}
