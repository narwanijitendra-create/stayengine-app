"use server";

import { createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

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

export type FoodOrderItemInput = {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
};

export type CreateFoodOrderInput = {
  hotelId: string;
  orderType: "room_service" | "dine_in" | "delivery";
  customerName: string;
  phone: string;
  roomNumber?: string;
  deliveryAddress?: string;
  items: FoodOrderItemInput[];
  totalAmount: number;
  currency: string;
  notes?: string;
};

export async function createFoodOrder(input: CreateFoodOrderInput) {
  const supabase = createServerClient();

  // Same pattern as create_guest_booking: insert happens through a
  // SECURITY DEFINER RPC so anonymous guests/outside customers can place an
  // order without needing a public SELECT policy on food_orders.
  const { data, error } = await supabase.rpc("create_food_order", {
    p_hotel_id: input.hotelId,
    p_order_type: input.orderType,
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_room_number: input.roomNumber ?? null,
    p_delivery_address: input.deliveryAddress ?? null,
    p_items: input.items,
    p_total_amount: input.totalAmount,
    p_currency: input.currency,
    p_notes: input.notes ?? null,
  });

  if (error || !data || !data[0]) {
    return { error: error?.message ?? "Could not place order" };
  }

  // Notify the hotel owner for room service / delivery orders (not dine-in,
  // since those are taken by a waiter who's already at the table). Best
  // effort - a failed/unconfigured email should never block the order.
  if (input.orderType === "room_service" || input.orderType === "delivery") {
    const { data: hotel } = await supabase
      .from("hotels")
      .select("name, contact_email, order_email_notifications_enabled")
      .eq("id", input.hotelId)
      .maybeSingle();

    if (hotel?.order_email_notifications_enabled && hotel.contact_email) {
      const itemsHtml = input.items
        .map((i) => `<li>${i.qty} &times; ${i.name} &mdash; ${(i.qty * i.price).toFixed(2)}</li>`)
        .join("");
      const orderTypeLabel = input.orderType === "room_service" ? "Room service" : "Delivery";
      const locationLine =
        input.orderType === "room_service"
          ? `Room: ${input.roomNumber || "not given"}`
          : `Deliver to: ${input.deliveryAddress || "not given"}`;

      await sendEmail({
        to: hotel.contact_email,
        subject: `New ${orderTypeLabel.toLowerCase()} order - ${input.customerName}`,
        html: `
          <p>New ${orderTypeLabel.toLowerCase()} order for <strong>${hotel.name}</strong>.</p>
          <p>${input.customerName} &amp; ${input.phone}</p>
          <p>${locationLine}</p>
          <ul>${itemsHtml}</ul>
          <p><strong>Total: ${input.totalAmount.toFixed(2)} ${input.currency}</strong></p>
          ${input.notes ? `<p>Note: ${input.notes}</p>` : ""}
        `,
      });
    }
  }

  return { order: data[0] };
}

export type CreateTableReservationInput = {
  hotelId: string;
  guestName: string;
  phone: string;
  email?: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  notes?: string;
};

export async function createTableReservation(input: CreateTableReservationInput) {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc("create_table_reservation", {
    p_hotel_id: input.hotelId,
    p_guest_name: input.guestName,
    p_phone: input.phone,
    p_email: input.email ?? null,
    p_reservation_date: input.reservationDate,
    p_reservation_time: input.reservationTime,
    p_party_size: input.partySize,
    p_notes: input.notes ?? null,
  });

  if (error || !data || !data[0]) {
    return { error: error?.message ?? "Could not book a table" };
  }

  return { reservation: data[0] };
}
