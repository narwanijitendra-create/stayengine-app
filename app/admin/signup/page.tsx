"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminSignup() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [hotelName, setHotelName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hotelName.trim() || !slug.trim() || !email.trim() || !password) {
      setError("Please fill in hotel name, URL, email and password.");
      return;
    }

    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (!signUpData.session) {
      // Email confirmation is required before we have an authenticated
      // session, so we can't create the hotel yet. It gets created
      // automatically the first time they log in (see admin/dashboard).
      setLoading(false);
      setNeedsConfirmation(true);
      return;
    }

    const { error: rpcError } = await supabase.rpc("request_new_hotel", {
      p_hotel_name: hotelName.trim(),
      p_slug: slugify(slug),
      p_full_name: fullName.trim() || null,
      p_phone: phone.trim() || null,
    });

    setLoading(false);

    if (rpcError) {
      setError(
        rpcError.message.includes("duplicate")
          ? "That URL is already taken — please choose another."
          : rpcError.message
      );
      return;
    }

    router.push("/admin/dashboard");
  }

  if (needsConfirmation) {
    return (
      <main className="max-w-sm mx-auto px-6 py-24">
        <h1 className="text-lg font-medium mb-2">Check your email</h1>
        <p className="text-sm text-gray-500">
          We sent a confirmation link to <strong>{email}</strong>. Confirm it, then log in — your
          hotel will be set up automatically on first login.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-lg font-medium mb-1">Create your hotel account</h1>
      <p className="text-sm text-gray-500 mb-6">
        Set up your property. A StayEngine admin will review and approve it before it goes live.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Hotel name"
          value={hotelName}
          onChange={(e) => {
            setHotelName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <div>
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden text-sm">
            <input
              type="text"
              placeholder="your-hotel"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className="flex-1 px-3 py-2 outline-none"
            />
            <span className="px-3 py-2 text-gray-400 bg-gray-50 text-xs whitespace-nowrap">
              .stayengine.app
            </span>
          </div>
        </div>
        <input
          type="text"
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-md py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create hotel account"}
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-6">
        Already have an account?{" "}
        <a href="/admin/login" className="underline">
          Sign in
        </a>
      </p>
    </main>
  );
}
