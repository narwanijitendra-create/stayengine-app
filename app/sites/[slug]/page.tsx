import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import BookingClient from "./booking-client";

export const revalidate = 0;

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.3,
  AUD: 1.53,
  CAD: 1.37,
  AED: 3.67,
  SGD: 1.34,
};

async function getFxRates(baseCurrency: string) {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("fx fetch failed");
    const data = await res.json();
    return { [baseCurrency]: 1, ...(data.rates ?? {}) } as Record<string, number>;
  } catch {
    const base = FALLBACK_RATES[baseCurrency] ?? 1;
    const relative: Record<string, number> = {};
    for (const [code, rate] of Object.entries(FALLBACK_RATES)) {
      relative[code] = rate / base;
    }
    return relative;
  }
}

export default async function HotelSitePage({ params }: { params: { slug: string } }) {
  const supabase = createServerClient();

  const { data: hotel } = await supabase
    .from("hotels")
    .select("*")
    .eq("slug", params.slug)
    .eq("status", "active")
    .single();

  if (!hotel) return notFound();

  const todayStr = new Date().toISOString().slice(0, 10);
  const horizonStr = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const [{ data: roomTypes }, { data: nearbyPoints }, { data: menuItems }, { data: menuCategories }, fxRates] =
    await Promise.all([
      supabase.from("room_types").select("*").eq("hotel_id", hotel.id).order("sort_order"),
      supabase.from("nearby_points").select("*").eq("hotel_id", hotel.id).order("sort_order"),
      supabase
        .from("menu_items")
        .select("*")
        .eq("hotel_id", hotel.id)
        .eq("is_available", true)
        .order("category")
        .order("sort_order"),
      supabase.from("menu_categories").select("*").eq("hotel_id", hotel.id).order("sort_order"),
      getFxRates(hotel.currency || "USD"),
    ]);

  const roomTypeIds = (roomTypes ?? []).map((rt) => rt.id);
  const { data: inventory } = roomTypeIds.length
    ? await supabase
        .from("inventory")
        .select("room_type_id, date, available_count")
        .in("room_type_id", roomTypeIds)
        .gte("date", todayStr)
        .lte("date", horizonStr)
    : { data: [] as { room_type_id: string; date: string; available_count: number }[] };

  return (
    <BookingClient
      hotel={hotel}
      roomTypes={roomTypes ?? []}
      nearbyPoints={nearbyPoints ?? []}
      inventory={inventory ?? []}
      fxRates={fxRates}
      menuItems={hotel.restaurant_enabled ? menuItems ?? [] : []}
      categories={hotel.restaurant_enabled ? menuCategories ?? [] : []}
      bookingEnabled={hotel.booking_enabled}
      restaurantEnabled={hotel.restaurant_enabled}
    />
  );
}
