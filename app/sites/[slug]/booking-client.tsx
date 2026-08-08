"use client";

import { useMemo, useState } from "react";
import { createBooking } from "./actions";
import type { Hotel, RoomType, NearbyPoint, InventoryDay } from "@/lib/types";

function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const AMENITY_ICONS: Record<string, string> = {
  "Free WiFi": "📶",
  "Breakfast included": "🍳",
  "24-hour front desk": "🛎️",
  "Air conditioning": "❄️",
  "Non-smoking rooms": "🚭",
  Bar: "🍸",
  "Pet friendly": "🐾",
  "Airport shuttle": "🚐",
  Pool: "🏊",
  Parking: "🅿️",
  Gym: "🏋️",
  Spa: "💆",
  "Beach access": "🏖️",
  "River view": "🌊",
  "Garden view": "🌳",
  Minibar: "🍹",
  Bathtub: "🛁",
  "Sofa bed": "🛋️",
  "Ensuite bathroom": "🚿",
  "Family friendly": "👨‍👩‍👧",
  Restaurant: "🍽️",
};

const CATEGORY_ICONS: Record<string, string> = {
  attraction: "🏛️",
  museum: "🖼️",
  historic: "⛪",
  transport: "🚉",
  natural: "🌳",
  beach: "🏖️",
  restaurant: "🍽️",
};

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED", "SGD"];

export default function BookingClient({
  hotel,
  roomTypes,
  nearbyPoints = [],
  inventory = [],
  fxRates = {},
  embedded = false,
}: {
  hotel: Hotel;
  roomTypes: RoomType[];
  nearbyPoints?: NearbyPoint[];
  inventory?: InventoryDay[];
  fxRates?: Record<string, number>;
  embedded?: boolean;
}) {
  const today = new Date();
  const inDefault = today.toISOString().slice(0, 10);
  const outDefault = addDays(inDefault, 2);

  const [checkIn, setCheckIn] = useState(inDefault);
  const [checkOut, setCheckOut] = useState(outDefault);
  const [guestsCount, setGuestsCount] = useState(2);
  const [currency, setCurrency] = useState(hotel.currency);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [step, setStep] = useState<"search" | "checkout" | "confirmed">("search");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accent = hotel.brand_color || "#1F4E5F";
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  const currencyOptions = useMemo(() => {
    const set = new Set([hotel.currency, ...CURRENCY_OPTIONS]);
    return Array.from(set);
  }, [hotel.currency]);

  function convert(amountInHotelCurrency: number) {
    const rate = currency === hotel.currency ? 1 : fxRates[currency] ?? 1;
    return amountInHotelCurrency * rate;
  }
  function fmt(amountInHotelCurrency: number) {
    return `${currency} ${convert(amountInHotelCurrency).toFixed(2)}`;
  }

  // date -> roomTypeId -> available_count, for the "open dates" strip and per-room availability
  const inventoryByDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const row of inventory) {
      if (!map.has(row.date)) map.set(row.date, new Map());
      map.get(row.date)!.set(row.room_type_id, row.available_count);
    }
    return map;
  }, [inventory]);

  function isRoomTypeAvailable(roomTypeId: string, from: string, to: string) {
    const n = nightsBetween(from, to);
    if (n === 0) return false;
    for (let i = 0; i < n; i++) {
      const d = addDays(from, i);
      const count = inventoryByDate.get(d)?.get(roomTypeId);
      if (count !== undefined && count <= 0) return false;
    }
    return true;
  }

  function isDateOpen(dateStr: string) {
    if (roomTypes.length === 0) return true;
    return roomTypes.some((rt) => {
      const count = inventoryByDate.get(dateStr)?.get(rt.id);
      return count === undefined || count > 0;
    });
  }

  const next21Days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(inDefault, i)), [inDefault]);

  async function handleConfirm() {
    if (!selectedRoom) return;
    setLoading(true);
    setError(null);
    const subtotal = selectedRoom.base_price * nights;
    const taxes = Math.round(subtotal * 0.12 * 100) / 100;
    const total = subtotal + taxes;
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

  const subtotal = selectedRoom ? selectedRoom.base_price * nights : 0;
  const taxes = Math.round(subtotal * 0.12 * 100) / 100;
  const total = subtotal + taxes;

  return (
    <div className={embedded ? "p-4 bg-stone-50" : "bg-stone-50 min-h-screen"}>
      {!embedded && step === "search" && (
        <Hero hotel={hotel} accent={accent} />
      )}

      <div className={embedded ? "" : "max-w-5xl mx-auto px-6 -mt-10 relative pb-16"}>
        {embedded && (
          <div className="flex items-center gap-3 mb-6">
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
            {!embedded && hotel.photo_gallery && hotel.photo_gallery.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 mb-6 -mt-2">
                {hotel.photo_gallery.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${hotel.name} photo ${i + 1}`}
                    className="h-28 w-40 flex-shrink-0 rounded-xl object-cover shadow-sm"
                  />
                ))}
              </div>
            )}

            {!embedded && hotel.amenities && hotel.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {hotel.amenities.map((a) => (
                  <span
                    key={a}
                    className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm"
                  >
                    {AMENITY_ICONS[a] ?? "✓"} {a}
                  </span>
                ))}
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 mb-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                <div className="col-span-2 sm:col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Show prices in</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {c} {c === hotel.currency ? "(hotel currency)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {nights === 0 && (
                <p className="text-xs text-red-600 mt-2">Check-out must be after check-in.</p>
              )}

              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Open dates (next 3 weeks) — tap to select check-in</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {next21Days.map((d) => {
                    const open = isDateOpen(d);
                    const isSelected = d === checkIn;
                    const dt = new Date(d);
                    return (
                      <button
                        key={d}
                        disabled={!open}
                        onClick={() => {
                          setCheckIn(d);
                          setCheckOut(addDays(d, Math.max(nights, 1)));
                        }}
                        className={`flex-shrink-0 w-12 rounded-lg border text-center py-1.5 text-[11px] ${
                          isSelected
                            ? "text-white border-transparent"
                            : open
                            ? "border-gray-200 hover:bg-gray-50"
                            : "border-gray-100 text-gray-300 line-through cursor-not-allowed"
                        }`}
                        style={isSelected ? { background: accent } : undefined}
                      >
                        <div>{dt.toLocaleDateString(undefined, { weekday: "short" })}</div>
                        <div className="font-medium">{dt.getDate()}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              {roomTypes.map((rt) => {
                const available = isRoomTypeAvailable(rt.id, checkIn, checkOut);
                const cover = rt.photos?.[0] || rt.photo_url;
                return (
                  <div key={rt.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={rt.name} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="h-16" style={{ background: accent + "22" }} />
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm">{rt.name}</p>
                        {!available && (
                          <span className="text-[10px] bg-red-50 text-red-600 rounded-full px-2 py-0.5">
                            Not available
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{rt.description}</p>
                      {rt.amenities && rt.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {rt.amenities.slice(0, 4).map((a) => (
                            <span key={a} className="text-[10px] bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                              {AMENITY_ICONS[a] ?? "✓"} {a}
                            </span>
                          ))}
                          {rt.amenities.length > 4 && (
                            <span className="text-[10px] text-gray-400 px-1 py-0.5">+{rt.amenities.length - 4} more</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium">
                          {fmt(rt.base_price)}
                          <span className="text-xs text-gray-400 font-normal"> /night</span>
                        </span>
                        <button
                          disabled={nights === 0 || rt.max_occupancy < 1 || !available}
                          onClick={() => {
                            setSelectedRoom(rt);
                            setStep("checkout");
                          }}
                          className="text-xs rounded-md px-3 py-1.5 text-white disabled:opacity-30"
                          style={{ background: accent }}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!embedded && (hotel.address || (nearbyPoints && nearbyPoints.length > 0)) && (
              <LocationSection hotel={hotel} nearbyPoints={nearbyPoints} />
            )}
          </>
        )}

        {step === "checkout" && selectedRoom && (
          <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm max-w-xl">
            <button className="text-xs text-gray-500 mb-4" onClick={() => setStep("search")}>
              ← Back
            </button>
            <p className="text-sm font-medium text-gray-600 mb-3">Booking summary</p>
            <div className="text-sm flex justify-between mb-1">
              <span>{selectedRoom.name} x {nights} nights</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="text-sm flex justify-between text-gray-500 mb-2">
              <span>Taxes and fees</span>
              <span>{fmt(taxes)}</span>
            </div>
            <div className="flex justify-between font-medium border-t border-gray-200 pt-2 mb-1">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
            {currency !== hotel.currency && (
              <p className="text-[11px] text-gray-400 mb-4">
                Shown in {currency} for reference (approx. exchange rate). You&apos;ll be charged {hotel.currency} {total.toFixed(2)}.
              </p>
            )}

            <div className="space-y-2 mb-4 mt-3">
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
          <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm text-center max-w-xl">
            <p className="text-lg font-medium mb-1">Booking confirmed</p>
            <p className="text-sm text-gray-500">
              A confirmation has been sent to {form.email}. See you at {hotel.name}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Hero({ hotel, accent }: { hotel: Hotel; accent: string }) {
  return (
    <div
      className="relative h-72 sm:h-96 w-full overflow-hidden"
      style={{
        backgroundImage: hotel.cover_photo_url ? `url(${hotel.cover_photo_url})` : undefined,
        backgroundColor: hotel.cover_photo_url ? undefined : accent,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
      <div className="relative max-w-5xl mx-auto px-6 h-full flex flex-col justify-end pb-10 text-white">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium border border-white/30"
            style={{ background: accent }}
          >
            {hotel.name.slice(0, 1)}
          </div>
          <span className="text-xs uppercase tracking-wide text-white/80">Direct booking</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold">{hotel.name}</h1>
        {hotel.tagline && <p className="text-sm sm:text-base text-white/90 mt-1">{hotel.tagline}</p>}
        {hotel.address && <p className="text-xs text-white/70 mt-2">📍 {hotel.address}</p>}
      </div>
    </div>
  );
}

function LocationSection({ hotel, nearbyPoints }: { hotel: Hotel; nearbyPoints: NearbyPoint[] }) {
  const hasCoords = hotel.latitude != null && hotel.longitude != null;
  const lat = hotel.latitude ?? 0;
  const lon = hotel.longitude ?? 0;
const mapSrc = hasCoords
      ? `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`
     : null;
  const directionsUrl = hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}` : null;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium mb-3">Location &amp; nearby</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          {mapSrc ? (
            <iframe title="Hotel location map" src={mapSrc} className="w-full h-56 border-0" loading="lazy" />
          ) : (
            <div className="w-full h-56 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
              Map not available yet
            </div>
          )}
          <div className="flex items-center justify-between p-3">
            {hotel.address && <p className="text-xs text-gray-500">{hotel.address}</p>}
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium underline whitespace-nowrap ml-2"
              >
                Get directions
              </a>
            )}
          </div>
        </div>
        {nearbyPoints && nearbyPoints.length > 0 && (
          <div className="border border-gray-200 rounded-2xl bg-white shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-3">Nearby attractions &amp; points of interest</p>
            <div className="space-y-2">
              {nearbyPoints.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>
                    {CATEGORY_ICONS[p.category ?? ""] ?? "📍"} {p.name}
                  </span>
                  {p.distance_label && <span className="text-xs text-gray-400">{p.distance_label}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
