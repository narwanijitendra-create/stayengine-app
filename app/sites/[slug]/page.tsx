import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import BookingClient from "./booking-client";

export const revalidate = 0;

export default async function HotelSitePage({ params }: { params: { slug: string } }) {
  const supabase = createServerClient();

  const { data: hotel } = await supabase
    .from("hotels")
    .select("*")
    .eq("slug", params.slug)
    .eq("status", "active")
    .single();

  if (!hotel) return notFound();

  const { data: roomTypes } = await supabase
    .from("room_types")
    .select("*")
    .eq("hotel_id", hotel.id)
    .order("sort_order");

  return <BookingClient hotel={hotel} roomTypes={roomTypes ?? []} />;
}
