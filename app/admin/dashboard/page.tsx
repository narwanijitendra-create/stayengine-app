"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Booking, RoomType, Hotel, NearbyPoint } from "@/lib/types";

type HotelUserRow = {
  id: string;
  hotel_id: string;
  role: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  hotels: Hotel;
};

type RoomFormState = {
  id: string | null;
  name: string;
  description: string;
  base_price: string;
  max_occupancy: string;
  total_rooms: string;
  photos: string[];
  amenities: string[];
};

const emptyRoomForm: RoomFormState = {
  id: null,
  name: "",
  description: "",
  base_price: "",
  max_occupancy: "2",
  total_rooms: "1",
  photos: [],
  amenities: [],
};

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
const HOTEL_AMENITY_OPTIONS = [
  "Free WiFi",
  "Breakfast included",
  "24-hour front desk",
  "Air conditioning",
  "Non-smoking rooms",
  "Bar",
  "Restaurant",
  "Pool",
  "Parking",
  "Gym",
  "Spa",
  "Pet friendly",
  "Airport shuttle",
  "Beach access",
];
const ROOM_AMENITY_OPTIONS = [
  "Free WiFi",
  "Air conditioning",
  "River view",
  "Garden view",
  "Minibar",
  "Bathtub",
  "Sofa bed",
  "Ensuite bathroom",
  "Family friendly",
  "Non-smoking rooms",
];
const NEARBY_CATEGORIES = [
  { value: "attraction", label: "Attraction", icon: "🏛️" },
  { value: "museum", label: "Museum / gallery", icon: "🖼️" },
  { value: "historic", label: "Historic site", icon: "⛪" },
  { value: "natural", label: "Park / nature", icon: "🌳" },
  { value: "beach", label: "Beach", icon: "🏖️" },
  { value: "restaurant", label: "Restaurant", icon: "🍽️" },
  { value: "transport", label: "Transport", icon: "🚉" },
];

async function uploadHotelMedia(
  supabase: ReturnType<typeof createBrowserClient>,
  hotelId: string,
  folder: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${hotelId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("hotel-media").upload(path, file, { upsert: true });
  if (error) {
    console.error("upload failed", error);
    return null;
  }
  const { data } = supabase.storage.from("hotel-media").getPublicUrl(path);
  return data.publicUrl;
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<main className="max-w-4xl mx-auto px-6 py-16 text-sm text-gray-500">Loading...</main>}>
      <AdminDashboardInner />
    </Suspense>
  );
}

function AdminDashboardInner() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const impersonateHotelId = searchParams.get("hotel");

  const [loading, setLoading] = useState(true);
  const [hotelUser, setHotelUser] = useState<HotelUserRow | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [nearbyPoints, setNearbyPoints] = useState<NearbyPoint[]>([]);
  const [tab, setTab] = useState<"overview" | "bookings" | "rooms" | "profile">("overview");
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [noHotelYet, setNoHotelYet] = useState(false);
  const [setupForm, setSetupForm] = useState({ name: "", slug: "" });
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [roomForm, setRoomForm] = useState<RoomFormState | null>(null);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomPhotoUploading, setRoomPhotoUploading] = useState(false);

  // Hotel profile draft (staged edits, saved on demand)
  const [hotelForm, setHotelForm] = useState<{
    tagline: string;
    description: string;
    address: string;
    latitude: string;
    longitude: string;
    brand_color: string;
    amenities: string[];
    contact_phone: string;
    contact_email: string;
    whatsapp_number: string;
  } | null>(null);
  const [hotelSaving, setHotelSaving] = useState(false);
  const [hotelSaveMsg, setHotelSaveMsg] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  // Personal admin profile
  const [meForm, setMeForm] = useState<{ full_name: string; phone: string } | null>(null);
  const [meSaving, setMeSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Nearby points
  const [nearbyForm, setNearbyForm] = useState({ name: "", category: "attraction", distance_label: "" });
  const [nearbySaving, setNearbySaving] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { name: string; category: string; lat: number; lon: number; distanceKm: number }[]
  >([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/admin/login");
        return;
      }

      const { data: pa } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();
      setIsPlatformAdmin(!!pa);

      // Super admin managing a hotel on its behalf: skip the normal
      // hotel_users lookup and load the target hotel directly.
      if (pa && impersonateHotelId) {
        const { data: targetHotel } = await supabase
          .from("hotels")
          .select("*")
          .eq("id", impersonateHotelId)
          .single();

        if (targetHotel) {
          const synthetic: HotelUserRow = {
            id: "",
            hotel_id: targetHotel.id,
            role: "owner",
            full_name: null,
            email: auth.user.email ?? "Super admin",
            phone: null,
            avatar_url: null,
            hotels: targetHotel,
          };
          setHotelUser(synthetic);
          setHotel(targetHotel);
          setHotelForm({
            tagline: targetHotel.tagline ?? "",
            description: targetHotel.description ?? "",
            address: targetHotel.address ?? "",
            latitude: targetHotel.latitude != null ? String(targetHotel.latitude) : "",
            longitude: targetHotel.longitude != null ? String(targetHotel.longitude) : "",
            brand_color: targetHotel.brand_color ?? "#1F4E5F",
            amenities: targetHotel.amenities ?? [],
            contact_phone: targetHotel.contact_phone ?? "",
            contact_email: targetHotel.contact_email ?? "",
            whatsapp_number: targetHotel.whatsapp_number ?? "",
          });

          const [{ data: b }, { data: rt }, { data: np }] = await Promise.all([
            supabase
              .from("bookings")
              .select("*")
              .eq("hotel_id", targetHotel.id)
              .order("check_in", { ascending: true }),
            supabase.from("room_types").select("*").eq("hotel_id", targetHotel.id).order("sort_order"),
            supabase.from("nearby_points").select("*").eq("hotel_id", targetHotel.id).order("sort_order"),
          ]);
          setBookings(b ?? []);
          setRoomTypes(rt ?? []);
          setNearbyPoints(np ?? []);
          setLoading(false);
          return;
        }
      }

      const { data: hu } = await supabase
        .from("hotel_users")
        .select("id, hotel_id, role, full_name, email, phone, avatar_url, hotels(*)")
        .eq("auth_user_id", auth.user.id)
        .single();

      if (!hu) {
        setNoHotelYet(true);
        setLoading(false);
        return;
      }
      const huTyped = hu as unknown as HotelUserRow;
      setHotelUser(huTyped);
      setHotel(huTyped.hotels);
      setMeForm({ full_name: huTyped.full_name ?? "", phone: huTyped.phone ?? "" });
      setHotelForm({
        tagline: huTyped.hotels.tagline ?? "",
        description: huTyped.hotels.description ?? "",
        address: huTyped.hotels.address ?? "",
        latitude: huTyped.hotels.latitude != null ? String(huTyped.hotels.latitude) : "",
        longitude: huTyped.hotels.longitude != null ? String(huTyped.hotels.longitude) : "",
        brand_color: huTyped.hotels.brand_color ?? "#1F4E5F",
        amenities: huTyped.hotels.amenities ?? [],
        contact_phone: huTyped.hotels.contact_phone ?? "",
        contact_email: huTyped.hotels.contact_email ?? "",
        whatsapp_number: huTyped.hotels.whatsapp_number ?? "",
      });

      const [{ data: b }, { data: rt }, { data: np }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .eq("hotel_id", huTyped.hotel_id)
          .order("check_in", { ascending: true }),
        supabase.from("room_types").select("*").eq("hotel_id", huTyped.hotel_id).order("sort_order"),
        supabase.from("nearby_points").select("*").eq("hotel_id", huTyped.hotel_id).order("sort_order"),
      ]);

      setBookings(b ?? []);
      setRoomTypes(rt ?? []);
      setNearbyPoints(np ?? []);
      setLoading(false);

      // Live bookings: subscribe to new/updated rows for this hotel so the
      // dashboard reflects guest bookings the moment they happen, with no refresh.
      const channel = supabase
        .channel(`bookings-${huTyped.hotel_id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings", filter: `hotel_id=eq.${huTyped.hotel_id}` },
          (payload) => {
            const newBooking = payload.new as Booking;
            setBookings((prev) => [newBooking, ...prev]);
            setJustArrived((prev) => new Set(prev).add(newBooking.id));
            setTimeout(() => {
              setJustArrived((prev) => {
                const next = new Set(prev);
                next.delete(newBooking.id);
                return next;
              });
            }, 5000);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "bookings", filter: `hotel_id=eq.${huTyped.hotel_id}` },
          (payload) => {
            const updated = payload.new as Booking;
            setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, []);

  async function saveRoomType() {
    if (!hotelUser || !roomForm) return;
    setRoomSaving(true);
    setRoomError(null);

    const payload = {
      hotel_id: hotelUser.hotel_id,
      name: roomForm.name.trim(),
      description: roomForm.description.trim() || null,
      base_price: Number(roomForm.base_price),
      max_occupancy: Number(roomForm.max_occupancy) || 1,
      total_rooms: Number(roomForm.total_rooms) || 1,
      photos: roomForm.photos,
      photo_url: roomForm.photos[0] ?? null,
      amenities: roomForm.amenities,
    };

    if (!payload.name || !payload.base_price || payload.base_price <= 0) {
      setRoomError("Name and a price above 0 are required.");
      setRoomSaving(false);
      return;
    }

    if (roomForm.id) {
      const { data, error } = await supabase
        .from("room_types")
        .update(payload)
        .eq("id", roomForm.id)
        .select()
        .single();
      if (error || !data) {
        setRoomError(error?.message ?? "Could not save changes.");
        setRoomSaving(false);
        return;
      }
      setRoomTypes((prev) => prev.map((rt) => (rt.id === data.id ? data : rt)));
    } else {
      const { data, error } = await supabase
        .from("room_types")
        .insert({ ...payload, sort_order: roomTypes.length + 1 })
        .select()
        .single();
      if (error || !data) {
        setRoomError(error?.message ?? "Could not create room type.");
        setRoomSaving(false);
        return;
      }
      setRoomTypes((prev) => [...prev, data]);
    }

    setRoomSaving(false);
    setRoomForm(null);
  }

  async function deleteRoomType(id: string) {
    if (!confirm("Remove this room type? Existing bookings for it are kept, but it won't be bookable anymore.")) return;
    const { error } = await supabase.from("room_types").delete().eq("id", id);
    if (!error) setRoomTypes((prev) => prev.filter((rt) => rt.id !== id));
  }

  async function handleRoomPhotoUpload(files: FileList | null) {
    if (!files || !hotelUser || !roomForm) return;
    setRoomPhotoUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadHotelMedia(supabase, hotelUser.hotel_id, "rooms", file);
      if (url) urls.push(url);
    }
    setRoomForm((prev) => (prev ? { ...prev, photos: [...prev.photos, ...urls] } : prev));
    setRoomPhotoUploading(false);
  }

  async function saveHotelProfile() {
    if (!hotelUser || !hotelForm) return;
    setHotelSaving(true);
    setHotelSaveMsg(null);
    const payload = {
      tagline: hotelForm.tagline.trim() || null,
      description: hotelForm.description.trim() || null,
      address: hotelForm.address.trim() || null,
      latitude: hotelForm.latitude ? Number(hotelForm.latitude) : null,
      longitude: hotelForm.longitude ? Number(hotelForm.longitude) : null,
      brand_color: hotelForm.brand_color,
      amenities: hotelForm.amenities,
      contact_phone: hotelForm.contact_phone.trim() || null,
      contact_email: hotelForm.contact_email.trim() || null,
      whatsapp_number: hotelForm.whatsapp_number.trim() || null,
    };
    const { data, error } = await supabase
      .from("hotels")
      .update(payload)
      .eq("id", hotelUser.hotel_id)
      .select()
      .single();
    setHotelSaving(false);
    if (error || !data) {
      setHotelSaveMsg(error?.message ?? "Could not save.");
      return;
    }
    setHotel(data);
    setHotelSaveMsg("Saved.");
    setTimeout(() => setHotelSaveMsg(null), 2500);
  }

  async function handleCoverUpload(file: File | null) {
    if (!file || !hotelUser) return;
    setCoverUploading(true);
    const url = await uploadHotelMedia(supabase, hotelUser.hotel_id, "cover", file);
    if (url) {
      const { data } = await supabase
        .from("hotels")
        .update({ cover_photo_url: url })
        .eq("id", hotelUser.hotel_id)
        .select()
        .single();
      if (data) setHotel(data);
    }
    setCoverUploading(false);
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files || !hotelUser || !hotel) return;
    setGalleryUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadHotelMedia(supabase, hotelUser.hotel_id, "gallery", file);
      if (url) urls.push(url);
    }
    const nextGallery = [...(hotel.photo_gallery ?? []), ...urls];
    const { data } = await supabase
      .from("hotels")
      .update({ photo_gallery: nextGallery })
      .eq("id", hotelUser.hotel_id)
      .select()
      .single();
    if (data) setHotel(data);
    setGalleryUploading(false);
  }

  async function removeGalleryPhoto(url: string) {
    if (!hotelUser || !hotel) return;
    const nextGallery = (hotel.photo_gallery ?? []).filter((u) => u !== url);
    const { data } = await supabase
      .from("hotels")
      .update({ photo_gallery: nextGallery })
      .eq("id", hotelUser.hotel_id)
      .select()
      .single();
    if (data) setHotel(data);
  }

  async function saveMyProfile() {
    if (!hotelUser || !meForm) return;
    setMeSaving(true);
    const { data, error } = await supabase
      .from("hotel_users")
      .update({ full_name: meForm.full_name.trim() || null, phone: meForm.phone.trim() || null })
      .eq("id", hotelUser.id)
      .select()
      .single();
    setMeSaving(false);
    if (!error && data) {
      setHotelUser((prev) => (prev ? { ...prev, full_name: data.full_name, phone: data.phone } : prev));
    }
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file || !hotelUser) return;
    setAvatarUploading(true);
    const url = await uploadHotelMedia(supabase, hotelUser.hotel_id, "admin", file);
    if (url) {
      const { data, error } = await supabase
        .from("hotel_users")
        .update({ avatar_url: url })
        .eq("id", hotelUser.id)
        .select()
        .single();
      if (!error && data) {
        setHotelUser((prev) => (prev ? { ...prev, avatar_url: data.avatar_url } : prev));
      }
    }
    setAvatarUploading(false);
  }

  async function addNearbyPoint() {
    if (!hotelUser || !nearbyForm.name.trim()) return;
    setNearbySaving(true);
    const { data, error } = await supabase
      .from("nearby_points")
      .insert({
        hotel_id: hotelUser.hotel_id,
        name: nearbyForm.name.trim(),
        category: nearbyForm.category,
        distance_label: nearbyForm.distance_label.trim() || null,
        source: "manual",
        sort_order: nearbyPoints.length + 1,
      })
      .select()
      .single();
    setNearbySaving(false);
    if (!error && data) {
      setNearbyPoints((prev) => [...prev, data]);
      setNearbyForm({ name: "", category: "attraction", distance_label: "" });
    }
  }

  async function deleteNearbyPoint(id: string) {
    const { error } = await supabase.from("nearby_points").delete().eq("id", id);
    if (!error) setNearbyPoints((prev) => prev.filter((p) => p.id !== id));
  }

  function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function suggestNearby() {
    if (!hotel?.latitude || !hotel?.longitude) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions([]);
    const lat = hotel.latitude;
    const lon = hotel.longitude;
    const query = `[out:json][timeout:15];(node["tourism"~"attraction|museum|viewpoint|artwork|gallery"](around:3000,${lat},${lon});node["natural"="beach"](around:3000,${lat},${lon});node["historic"](around:3000,${lat},${lon}););out body 25;`;
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });
      const data = await res.json();
      const found = (data.elements ?? [])
        .filter((el: any) => el.tags?.name)
        .map((el: any) => {
          const tags = el.tags ?? {};
          const category = tags.tourism === "attraction" || tags.tourism ? tags.tourism : tags.historic ? "historic" : tags.natural === "beach" ? "beach" : "attraction";
          return {
            name: tags.name as string,
            category: category === "museum" ? "museum" : category === "viewpoint" || category === "artwork" || category === "gallery" || category === "attraction" ? "attraction" : category,
            lat: el.lat,
            lon: el.lon,
            distanceKm: haversineKm(lat, lon, el.lat, el.lon),
          };
        })
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
        .slice(0, 12);
      setSuggestions(found);
      if (found.length === 0) setSuggestError("No named points of interest found nearby — try adding some manually.");
    } catch {
      setSuggestError("Couldn't reach the map service. Try again in a moment, or add points manually.");
    }
    setSuggesting(false);
  }

  async function addSuggestion(s: { name: string; category: string; lat: number; lon: number; distanceKm: number }) {
    if (!hotelUser) return;
    const { data, error } = await supabase
      .from("nearby_points")
      .insert({
        hotel_id: hotelUser.hotel_id,
        name: s.name,
        category: s.category,
        distance_label: `${s.distanceKm < 1 ? Math.round(s.distanceKm * 1000) + " m" : s.distanceKm.toFixed(1) + " km"}`,
        lat: s.lat,
        lon: s.lon,
        source: "auto",
        sort_order: nearbyPoints.length + 1,
      })
      .select()
      .single();
    if (!error && data) {
      setNearbyPoints((prev) => [...prev, data]);
      setSuggestions((prev) => prev.filter((x) => x.name !== s.name));
    }
  }

  function toggleAmenity(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  if (loading) return <main className="max-w-4xl mx-auto px-6 py-16 text-sm text-gray-500">Loading...</main>;

  if (!hotelUser || !hotel) {
    if (noHotelYet) {
      return (
        <main className="max-w-sm mx-auto px-6 py-24">
          <h1 className="text-lg font-medium mb-1">Set up your hotel</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your account isn&apos;t linked to a hotel yet. Create one below — a StayEngine admin
            will review and approve it before it goes live.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSetupError(null);
              if (!setupForm.name.trim() || !setupForm.slug.trim()) {
                setSetupError("Please fill in both fields.");
                return;
              }
              setSetupSaving(true);
              const { error } = await supabase.rpc("request_new_hotel", {
                p_hotel_name: setupForm.name.trim(),
                p_slug: setupForm.slug
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, ""),
                p_full_name: null,
                p_phone: null,
              });
              setSetupSaving(false);
              if (error) {
                setSetupError(
                  error.message.includes("duplicate")
                    ? "That URL is already taken — please choose another."
                    : error.message
                );
                return;
              }
              window.location.reload();
            }}
            className="space-y-3"
          >
            <input
              type="text"
              placeholder="Hotel name"
              value={setupForm.name}
              onChange={(e) => setSetupForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="your-hotel (URL)"
              value={setupForm.slug}
              onChange={(e) => setSetupForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            {setupError && <p className="text-xs text-red-600">{setupError}</p>}
            <button
              disabled={setupSaving}
              className="w-full bg-gray-900 text-white rounded-md py-2 text-sm disabled:opacity-50"
            >
              {setupSaving ? "Creating..." : "Create hotel"}
            </button>
          </form>
        </main>
      );
    }
    return (
      <main className="max-w-4xl mx-auto px-6 py-16 text-sm text-gray-500">
        Your account isn&apos;t linked to a hotel yet. Add a row to hotel_users for this
        auth user (see README).
      </main>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysCheckins = bookings.filter((b) => b.check_in === todayStr).length;
  const revenue = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + Number(b.total_amount), 0);

  const roomNameById = (id: string) => roomTypes.find((r) => r.id === id)?.name ?? "Room";

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {hotel.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hotel.cover_photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-medium"
              style={{ background: hotel.brand_color || "#1F4E5F" }}
            >
              {hotel.name.slice(0, 1)}
            </div>
          )}
          <div>
            <p className="font-medium">{hotel.name}</p>
            <p className="text-xs text-gray-500">{hotel.slug}.stayengine.app</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hotelUser.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hotelUser.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" title={hotelUser.full_name ?? hotelUser.email} />
          ) : null}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            className="text-xs border border-gray-300 rounded-md px-3 py-1.5"
          >
            Sign out
          </button>
        </div>
      </div>

      {isPlatformAdmin && impersonateHotelId && (
        <div className="mb-6 text-sm rounded-md px-4 py-3 bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-between">
          <span>Managing {hotel.name} as super admin.</span>
          <a href="/super-admin" className="underline whitespace-nowrap ml-3">
            Back to super admin
          </a>
        </div>
      )}

      {hotel.status !== "active" && (
        <div
          className={`mb-6 text-sm rounded-md px-4 py-3 ${
            hotel.status === "pending"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {hotel.status === "pending"
            ? "Your hotel is pending approval. It won't be visible to guests until a StayEngine admin approves it."
            : `Your hotel is currently ${hotel.status}. Contact StayEngine support for details.`}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["overview", "bookings", "rooms", "profile"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-3 py-1.5 rounded-md border ${
              tab === t ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"
            }`}
          >
            {t === "profile" ? "Hotel profile" : t[0].toUpperCase() + t.slice(1)}
            {t === "bookings" && justArrived.size > 0 && (
              <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400 align-middle" />
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total bookings" value={String(bookings.length)} />
          <Metric label="Check-ins today" value={String(todaysCheckins)} />
          <Metric label="Revenue (all time)" value={`$${revenue.toFixed(2)}`} />
          <Metric label="Room types" value={String(roomTypes.length)} />
        </div>
      )}

      {tab === "bookings" && (
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
          <div className="p-3 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-t-xl">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
            Live — new bookings appear here automatically
          </div>
          {bookings.length === 0 && <p className="p-4 text-sm text-gray-500">No bookings yet.</p>}
          {bookings.map((b) => (
            <div
              key={b.id}
              className={`p-3 flex items-center justify-between text-sm transition-colors ${
                justArrived.has(b.id) ? "bg-green-50" : ""
              }`}
            >
              <div>
                <p>{roomNameById(b.room_type_id)}</p>
                <p className="text-xs text-gray-400">
                  {b.check_in} → {b.check_out} · {b.guests_count} guest{b.guests_count > 1 ? "s" : ""}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-md ${
                  b.status === "confirmed"
                    ? "bg-green-50 text-green-700"
                    : b.status === "pending"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {b.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "rooms" && (
        <div>
          <div className="flex justify-end mb-3">
            <button
              onClick={() => {
                setRoomError(null);
                setRoomForm({ ...emptyRoomForm });
              }}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50"
            >
              + Add room type
            </button>
          </div>

          {roomForm && (
            <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
              <p className="text-sm font-medium mb-3">{roomForm.id ? "Edit room type" : "New room type"}</p>
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                <input
                  placeholder="Name (e.g. Garden view room)"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  placeholder="Description"
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  placeholder="Price per night (USD)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomForm.base_price}
                  onChange={(e) => setRoomForm({ ...roomForm, base_price: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Max occupancy"
                  type="number"
                  min="1"
                  value={roomForm.max_occupancy}
                  onChange={(e) => setRoomForm({ ...roomForm, max_occupancy: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Number of rooms of this type"
                  type="number"
                  min="1"
                  value={roomForm.total_rooms}
                  onChange={(e) => setRoomForm({ ...roomForm, total_rooms: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
                />
              </div>

              <p className="text-xs text-gray-500 mb-1 mt-3">Photos</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {roomForm.photos.map((url) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-md" />
                    <button
                      onClick={() => setRoomForm({ ...roomForm, photos: roomForm.photos.filter((u) => u !== url) })}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-900 text-white rounded-full text-[10px] leading-4"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleRoomPhotoUpload(e.target.files)}
                className="text-xs mb-3"
                disabled={roomPhotoUploading}
              />
              {roomPhotoUploading && <p className="text-xs text-gray-400 mb-2">Uploading...</p>}

              <p className="text-xs text-gray-500 mb-1">Amenities</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {ROOM_AMENITY_OPTIONS.map((a) => {
                  const active = roomForm.amenities.includes(a);
                  return (
                    <button
                      key={a}
                      onClick={() => setRoomForm({ ...roomForm, amenities: toggleAmenity(roomForm.amenities, a) })}
                      className={`text-[11px] rounded-full px-2.5 py-1 border ${
                        active ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"
                      }`}
                    >
                      {AMENITY_ICONS[a] ?? "✓"} {a}
                    </button>
                  );
                })}
              </div>

              {roomError && <p className="text-xs text-red-600 mb-2">{roomError}</p>}
              <div className="flex gap-2">
                <button
                  disabled={roomSaving}
                  onClick={saveRoomType}
                  className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
                >
                  {roomSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setRoomForm(null)}
                  className="text-xs border border-gray-300 rounded-md px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {roomTypes.map((rt) => (
              <div key={rt.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {rt.photos?.[0] || rt.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={rt.photos?.[0] || rt.photo_url || ""} alt="" className="w-full h-28 object-cover" />
                ) : null}
                <div className="p-4">
                  <p className="text-sm font-medium">{rt.name}</p>
                  <p className="text-xs text-gray-500 mb-2">{rt.description}</p>
                  <p className="text-sm mb-2">
                    ${rt.base_price}/night · {rt.total_rooms} rooms · sleeps {rt.max_occupancy}
                  </p>
                  {rt.amenities && rt.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {rt.amenities.map((a) => (
                        <span key={a} className="text-[10px] bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                          {AMENITY_ICONS[a] ?? "✓"} {a}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setRoomForm({
                          id: rt.id,
                          name: rt.name,
                          description: rt.description ?? "",
                          base_price: String(rt.base_price),
                          max_occupancy: String(rt.max_occupancy),
                          total_rooms: String(rt.total_rooms),
                          photos: rt.photos ?? [],
                          amenities: rt.amenities ?? [],
                        })
                      }
                      className="text-xs border border-gray-300 rounded-md px-2.5 py-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRoomType(rt.id)}
                      className="text-xs border border-gray-300 rounded-md px-2.5 py-1 text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {roomTypes.length === 0 && !roomForm && (
              <p className="text-sm text-gray-500">No room types yet. Add your first one above.</p>
            )}
          </div>
        </div>
      )}

      {tab === "profile" && hotelForm && (
        <div className="space-y-6">
          {/* Hotel content & branding */}
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium mb-3">Hotel profile &amp; design</p>

            <p className="text-xs text-gray-500 mb-1">Cover photo (shown at the top of your booking site)</p>
            {hotel.cover_photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hotel.cover_photo_url} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={coverUploading}
              onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
              className="text-xs mb-4"
            />
            {coverUploading && <p className="text-xs text-gray-400 mb-2">Uploading...</p>}

            <p className="text-xs text-gray-500 mb-1">Photo gallery</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(hotel.photo_gallery ?? []).map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-16 h-16 object-cover rounded-md" />
                  <button
                    onClick={() => removeGalleryPhoto(url)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-900 text-white rounded-full text-[10px] leading-4"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={galleryUploading}
              onChange={(e) => handleGalleryUpload(e.target.files)}
              className="text-xs mb-4"
            />
            {galleryUploading && <p className="text-xs text-gray-400 mb-2">Uploading...</p>}

            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <input
                placeholder="Tagline (short, e.g. Boutique stays by the river)"
                value={hotelForm.tagline}
                onChange={(e) => setHotelForm({ ...hotelForm, tagline: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                placeholder="Description shown to guests"
                value={hotelForm.description}
                onChange={(e) => setHotelForm({ ...hotelForm, description: e.target.value })}
                rows={3}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                placeholder="Address"
                value={hotelForm.address}
                onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                placeholder="Contact phone (shown to guests)"
                value={hotelForm.contact_phone}
                onChange={(e) => setHotelForm({ ...hotelForm, contact_phone: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                placeholder="Contact email (shown to guests)"
                type="email"
                value={hotelForm.contact_email}
                onChange={(e) => setHotelForm({ ...hotelForm, contact_email: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                placeholder="WhatsApp number, e.g. +91 98765 43210"
                value={hotelForm.whatsapp_number}
                onChange={(e) => setHotelForm({ ...hotelForm, whatsapp_number: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
              />
              <p className="text-xs text-gray-400 sm:col-span-2 -mt-2">
                Include the country code for WhatsApp (e.g. +91 for India) so the chat link works correctly.
              </p>
              <LocationPicker
                latitude={hotelForm.latitude}
                longitude={hotelForm.longitude}
                onLocationChange={(lat, lon) =>
                  setHotelForm({
                    ...hotelForm,
                    latitude: lat,
                    longitude: lon,
                  })
                }
              />
              <div className="sm:col-span-2 flex items-center gap-2">
                <label className="text-xs text-gray-500">Theme color</label>
                <input
                  type="color"
                  value={hotelForm.brand_color}
                  onChange={(e) => setHotelForm({ ...hotelForm, brand_color: e.target.value })}
                  className="w-8 h-8 border border-gray-300 rounded"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-1 mt-2">Hotel amenities</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {HOTEL_AMENITY_OPTIONS.map((a) => {
                const active = hotelForm.amenities.includes(a);
                return (
                  <button
                    key={a}
                    onClick={() => setHotelForm({ ...hotelForm, amenities: toggleAmenity(hotelForm.amenities, a) })}
                    className={`text-[11px] rounded-full px-2.5 py-1 border ${
                      active ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"
                    }`}
                  >
                    {AMENITY_ICONS[a] ?? "✓"} {a}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={saveHotelProfile}
                disabled={hotelSaving}
                className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {hotelSaving ? "Saving..." : "Save hotel profile"}
              </button>
              {hotelSaveMsg && <span className="text-xs text-gray-500">{hotelSaveMsg}</span>}
            </div>
          </div>

          {/* Nearby attractions */}
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium mb-3">Nearby attractions &amp; points of interest</p>

            <div className="space-y-1.5 mb-3">
              {nearbyPoints.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-md px-3 py-1.5">
                  <span>
                    {NEARBY_CATEGORIES.find((c) => c.value === p.category)?.icon ?? "📍"} {p.name}
                    {p.distance_label && <span className="text-xs text-gray-400"> · {p.distance_label}</span>}
                  </span>
                  <button onClick={() => deleteNearbyPoint(p.id)} className="text-xs text-red-600">
                    Remove
                  </button>
                </div>
              ))}
              {nearbyPoints.length === 0 && <p className="text-xs text-gray-400">None added yet.</p>}
            </div>

            <div className="grid sm:grid-cols-4 gap-2 mb-2">
              <input
                placeholder="Name"
                value={nearbyForm.name}
                onChange={(e) => setNearbyForm({ ...nearbyForm, name: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
              />
              <select
                value={nearbyForm.category}
                onChange={(e) => setNearbyForm({ ...nearbyForm, category: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-2 text-sm"
              >
                {NEARBY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Distance (e.g. 5 min walk)"
                value={nearbyForm.distance_label}
                onChange={(e) => setNearbyForm({ ...nearbyForm, distance_label: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={addNearbyPoint}
              disabled={nearbySaving || !nearbyForm.name.trim()}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 mb-4 disabled:opacity-50"
            >
              + Add
            </button>

            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={suggestNearby}
                disabled={suggesting || !hotel.latitude || !hotel.longitude}
                className="text-xs border border-gray-300 rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {suggesting ? "Looking around..." : "Auto-suggest nearby places"}
              </button>
              {!hotel.latitude && (
                <p className="text-xs text-gray-400 mt-1">Set your address and coordinates above first.</p>
              )}
              {suggestError && <p className="text-xs text-red-600 mt-2">{suggestError}</p>}
              {suggestions.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {suggestions.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-sm border border-gray-100 rounded-md px-3 py-1.5">
                      <span>
                        {NEARBY_CATEGORIES.find((c) => c.value === s.category)?.icon ?? "📍"} {s.name}
                        <span className="text-xs text-gray-400"> · {s.distanceKm < 1 ? Math.round(s.distanceKm * 1000) + "m" : s.distanceKm.toFixed(1) + "km"}</span>
                      </span>
                      <button onClick={() => addSuggestion(s)} className="text-xs text-gray-900 border border-gray-300 rounded-md px-2 py-0.5">
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Personal admin profile */}
          {meForm && hotelUser.id && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium mb-3">Your profile</p>
              <div className="flex items-center gap-3 mb-3">
                {hotelUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hotelUser.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg">
                    {(hotelUser.full_name || hotelUser.email).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={avatarUploading}
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                <input
                  placeholder="Full name"
                  value={meForm.full_name}
                  onChange={(e) => setMeForm({ ...meForm, full_name: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Phone"
                  value={meForm.phone}
                  onChange={(e) => setMeForm({ ...meForm, phone: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {hotelUser.email} · {hotelUser.role}
              </p>
              <button
                onClick={saveMyProfile}
                disabled={meSaving}
                className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {meSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function LocationPicker({
  latitude,
  longitude,
  onLocationChange,
}: {
  latitude: string;
  longitude: string;
  onLocationChange: (lat: string, lon: string) => void;
}) {
  const [mapsLinkInput, setMapsLinkInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  function extractLatLon(text: string): { lat: number; lon: number } | null {
    const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { lat: Number(atMatch[1]), lon: Number(atMatch[2]) };
    const qMatch = text.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) return { lat: Number(qMatch[1]), lon: Number(qMatch[2]) };
    const llMatch = text.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llMatch) return { lat: Number(llMatch[1]), lon: Number(llMatch[2]) };
    const plainMatch = text.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    if (plainMatch) return { lat: Number(plainMatch[1]), lon: Number(plainMatch[2]) };
    return null;
  }

  async function handleUseMapsLink() {
    const text = mapsLinkInput.trim();
    if (!text) return;
    setLinkError(null);

    const direct = extractLatLon(text);
    if (direct) {
      onLocationChange(String(direct.lat), String(direct.lon));
      setMapsLinkInput("");
      return;
    }

    if (!/^https?:\/\//i.test(text)) {
      setLinkError('Couldn\'t find coordinates in that text. Paste a Google Maps link, or type "lat, lon" directly.');
      return;
    }

    setResolving(true);
    try {
      const res = await fetch("/api/resolve-maps-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: text }),
      });
      const data = await res.json();
      const resolved: { lat: number; lon: number } | null = data.finalUrl ? extractLatLon(data.finalUrl) : null;
      if (resolved) {
        onLocationChange(String(resolved.lat), String(resolved.lon));
        setMapsLinkInput("");
      } else {
        setLinkError(
          "Couldn't find coordinates in that link. Open it in Google Maps, make sure the pin is on the hotel, then copy the link again."
        );
      }
    } catch {
      setLinkError("Couldn't read that link. Try pasting the latitude/longitude directly instead.");
    }
    setResolving(false);
  }

  const hasCoords =
    !!latitude && !!longitude && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude));
  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : null;
  const previewSrc = hasCoords
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : null;

  return (
    <div className="sm:col-span-2">
      <p className="text-xs text-gray-500 mb-1">
        Set the hotel&apos;s exact coordinates — paste a Google Maps link, or type latitude/longitude
        directly. This only sets the coordinates; type the Address above separately.
      </p>
      <div className="flex gap-2 mb-2">
        <input
          placeholder="Paste a Google Maps link (or type: lat, lon)"
          value={mapsLinkInput}
          onChange={(e) => setMapsLinkInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleUseMapsLink();
            }
          }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
        />
        <button
          type="button"
          onClick={handleUseMapsLink}
          disabled={resolving || !mapsLinkInput.trim()}
          className="text-xs border border-gray-300 rounded-md px-3 py-2 whitespace-nowrap disabled:opacity-50"
        >
          {resolving ? "Reading link..." : "Use this"}
        </button>
      </div>
      {linkError && <p className="text-xs text-red-500 mb-2">{linkError}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Latitude"
          value={latitude}
          onChange={(e) => onLocationChange(e.target.value, longitude)}
          className="border border-gray-300 rounded-md px-3 py-2 text-xs"
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Longitude"
          value={longitude}
          onChange={(e) => onLocationChange(latitude, e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-xs"
        />
      </div>
      {previewSrc && (
        <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
          <iframe title="Location preview" src={previewSrc} className="w-full h-56 border-0" loading="lazy" />
        </div>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-gray-400">
          {hasCoords
            ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
            : "No location set yet"}
        </p>
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] underline text-gray-500"
          >
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}


function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-medium">{value}</p>
    </div>
  );
}
