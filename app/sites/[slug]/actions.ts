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

  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .insert({
      hotel_id: input.hotelId,
      name: input.guestName,
      email: input.guestEmail,
      phone: input.guestPhone ?? null,
    })
    .select()
    .single();

  if (guestError || !guest) {
    return { error: guestError?.message ?? "Could not save guest details" };
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      hotel_id: input.hotelId,
      room_type_id: input.roomTypeId,
      guest_id: guest.id,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guests_count: input.guestsCount,
      total_amount: input.totalAmount,
      currency: input.currency,
      status: "confirmed",
      source: input.source ?? "direct",
    })
    .select()
    .single();

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create booking" };
  }

  return { booking };
}
