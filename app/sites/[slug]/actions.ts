"use server";

import { createServerClient } from "@/lib/supabase/server";

export type CreateBookingInput = {
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  totalAmount: number;
  currency: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  source?: "direct" | "widget";
};

export async function createBooking(input: CreateBookingInput) {
  const supabase = createServerClient();

  // Guest + booking creation goes through a SECURITY DEFINER Postgres function
  // (create_guest_booking) rather than direct table inserts. Anonymous guests
  // are allowed to insert, but PostgREST's insert().select() also requires a
  // matching SELECT policy to return the row - and we deliberately don't
  // expose a public SELECT policy on `guests` (it holds PII). The RPC inserts
  // both rows server-side with elevated privileges and returns only the
  // booking id/status, never guest details.
  const { data, error } = await supabase.rpc("create_guest_booking", {
    p_hotel_id: input.hotelId,
    p_room_type_id: input.roomTypeId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guests_count: input.guestsCount,
    p_total_amount: input.totalAmount,
    p_currency: input.currency,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_guest_phone: input.guestPhone ?? null,
    p_source: input.source ?? "direct",
  });

  if (error || !data || !data[0]) {
    return { error: error?.message ?? "Could not create booking" };
  }

  return { booking: data[0] };
}
