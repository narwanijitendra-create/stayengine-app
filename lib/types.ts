export type Hotel = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  plan: "starter" | "growth" | "pro";
  brand_color: string;
  currency: string;
  status: "pending" | "active" | "suspended" | "trial";
  description: string | null;
  tagline: string | null;
  cover_photo_url: string | null;
  photo_gallery: string[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
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
  photos: string[];
  amenities: string[];
  sort_order: number;
};

export type NearbyPoint = {
  id: string;
  hotel_id: string;
  name: string;
  category: string | null;
  distance_label: string | null;
  lat: number | null;
  lon: number | null;
  source: string;
  sort_order: number;
};

export type InventoryDay = {
  room_type_id: string;
  date: string;
  available_count: number;
};

export type HotelUserProfile = {
  id: string;
  hotel_id: string;
  role: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
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
