import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import BookingClient from "../../sites/[slug]/booking-client";

// Lightweight iframe target for the embeddable widget (see public/widget.js).
// Hotels drop <script src=".../widget.js" data-hotel="slug"></script> on their
// own site; it injects an iframe pointing here.
export const revalidate = 0;

export default async function WidgetPage({ params }: { params: { slug: string } }) {
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

  return <BookingClient hotel={hotel} roomTypes={roomTypes ?? []} embedded />;
}
