"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Booking, RoomType } from "@/lib/types";

type HotelUserRow = { hotel_id: string; role: string; hotels: { name: string; slug: string } };

type RoomFormState = {
  id: string | null;
  name: string;
  description: string;
  base_price: string;
  max_occupancy: string;
  total_rooms: string;
};

const emptyRoomForm: RoomFormState = {
  id: null,
  name: "",
  description: "",
  base_price: "",
  max_occupancy: "2",
  total_rooms: "1",
};

export default function AdminDashboard() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hotelUser, setHotelUser] = useState<HotelUserRow | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [tab, setTab] = useState<"overview" | "bookings" | "rooms">("overview");
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());

  const [roomForm, setRoomForm] = useState<RoomFormState | null>(null);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/admin/login");
        return;
      }

      const { data: hu } = await supabase
        .from("hotel_users")
        .select("hotel_id, role, hotels(name, slug)")
        .eq("auth_user_id", auth.user.id)
        .single();

      if (!hu) {
        setLoading(false);
        return;
      }
      setHotelUser(hu as unknown as HotelUserRow);

      const [{ data: b }, { data: rt }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .eq("hotel_id", hu.hotel_id)
          .order("check_in", { ascending: true }),
        supabase.from("room_types").select("*").eq("hotel_id", hu.hotel_id).order("sort_order"),
      ]);

      setBookings(b ?? []);
      setRoomTypes(rt ?? []);
      setLoading(false);

      // Live bookings: subscribe to new/updated rows for this hotel so the
      // dashboard reflects guest bookings the moment they happen, with no refresh.
      const channel = supabase
        .channel(`bookings-${hu.hotel_id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings", filter: `hotel_id=eq.${hu.hotel_id}` },
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
          { event: "UPDATE", schema: "public", table: "bookings", filter: `hotel_id=eq.${hu.hotel_id}` },
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

  if (loading) return <main className="max-w-4xl mx-auto px-6 py-16 text-sm text-gray-500">Loading...</main>;

  if (!hotelUser) {
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
        <div>
          <p className="font-medium">{hotelUser.hotels?.name}</p>
          <p className="text-xs text-gray-500">{hotelUser.hotels?.slug}.stayengine.app</p>
        </div>
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

      <div className="flex gap-2 mb-6">
        {(["overview", "bookings", "rooms"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-3 py-1.5 rounded-md border ${
              tab === t ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"
            }`}
          >
            {t[0].toUpperCase() + t.slice(1)}
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
              <div key={rt.id} className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium">{rt.name}</p>
                <p className="text-xs text-gray-500 mb-2">{rt.description}</p>
                <p className="text-sm mb-3">
                  ${rt.base_price}/night · {rt.total_rooms} rooms · sleeps {rt.max_occupancy}
                </p>
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
            ))}
            {roomTypes.length === 0 && !roomForm && (
              <p className="text-sm text-gray-500">No room types yet. Add your first one above.</p>
            )}
          </div>
        </div>
      )}
    </main>
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
