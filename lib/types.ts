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
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp_number: string | null;
  booking_enabled: boolean;
  restaurant_enabled: boolean;
  table_reservation_enabled: boolean;
  room_service_enabled: boolean;
  delivery_enabled: boolean;
  order_email_notifications_enabled: boolean;
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

export type MenuCategory = {
  id: string;
  hotel_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
};

export type MenuItem = {
  id: string;
  hotel_id: string;
  category: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  is_veg: boolean | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
};

export type TableReservation = {
  id: string;
  hotel_id: string;
  guest_name: string;
  phone: string;
  email: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  created_at: string;
};

export type FoodOrderItem = {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
};

export type FoodOrder = {
  id: string;
  hotel_id: string;
  order_type: "room_service" | "dine_in" | "delivery";
  customer_name: string;
  phone: string;
  room_number: string | null;
  delivery_address: string | null;
  table_number: string | null;
  items: FoodOrderItem[];
  total_amount: number;
  currency: string;
  status: "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  notes: string | null;
  created_at: string;
};
