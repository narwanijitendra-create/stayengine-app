"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Booking, RoomType } from "@/lib/types";

type HotelUserRow = { hotel_id: string; role: string; hotels: { name: string; slug: string } };

export default function AdminDashboard() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hotelUser, setHotelUser] = useState<HotelUserRow | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [tab, setTab] = useState<"overview" | "bookings" | "rooms">("overview");

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
    })();
  }, []);

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
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total bookings" value={String(bookings.length)} />
          <Metric label="Check-ins today" value={String(todaysCheckins)} />
          <Metric label="Revenue (all time)" value={`${roomTypes[0]?.base_price ? "$" : ""}${revenue.toFixed(2)}`} />
          <Metric label="Room types" value={String(roomTypes.length)} />
        </div>
      )}

      {tab === "bookings" && (
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
          {bookings.length === 0 && <p className="p-4 text-sm text-gray-500">No bookings yet.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="p-3 flex items-center justify-between text-sm">
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
        <div className="grid sm:grid-cols-2 gap-3">
          {roomTypes.map((rt) => (
            <div key={rt.id} className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium">{rt.name}</p>
              <p className="text-xs text-gray-500 mb-2">{rt.description}</p>
              <p className="text-sm">
                ${rt.base_price}/night · {rt.total_rooms} rooms
              </p>
            </div>
          ))}
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
