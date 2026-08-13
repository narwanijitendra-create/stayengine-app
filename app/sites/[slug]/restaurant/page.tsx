import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import RestaurantSection from "../restaurant-section";

export const revalidate = 0;

export default async function RestaurantPage({ params }: { params: { slug: string } }) {
  const supabase = createServerClient();

  const { data: hotel } = await supabase
    .from("hotels")
    .select("*")
    .eq("slug", params.slug)
    .eq("status", "active")
    .single();

  if (!hotel) return notFound();

  if (!hotel.restaurant_enabled) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <Link href={`/sites/${hotel.slug}`} className="text-xs text-gray-500 hover:underline mb-6 inline-block">
            ← Back to {hotel.name}
          </Link>
          <p className="text-sm text-gray-400 mt-10">The restaurant isn&apos;t available for this property.</p>
        </div>
      </div>
    );
  }

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("*")
    .eq("hotel_id", hotel.id)
    .eq("is_available", true)
    .order("category")
    .order("sort_order");

  const { data: menuCategories } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("hotel_id", hotel.id)
    .order("sort_order");

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href={`/sites/${hotel.slug}`} className="text-xs text-gray-500 hover:underline mb-6 inline-block">
          ← Back to {hotel.name}
        </Link>

        {menuItems && menuItems.length > 0 ? (
          <RestaurantSection hotel={hotel} menuItems={menuItems} categories={menuCategories ?? []} />
        ) : (
          <p className="text-sm text-gray-400 mt-10">The restaurant menu isn&apos;t available right now.</p>
        )}
      </div>
    </div>
  );
}
