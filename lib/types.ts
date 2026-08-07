export type Hotel = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  plan: "starter" | "growth" | "pro";
  brand_color: string;
  currency: string;
  status: string;
};

export type RoomType = {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  base_price: number;
  max_occupancy: number;
  total_rooms: number;
  photo_url: string | null;
  sort_order: number;
};

export type Booking = {
  id: string;
  hotel_id: string;
  room_type_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  total_amount: number;
  currency: string;
  source: string;
  created_at: string;
};
