import { createClient } from "@supabase/supabase-js";

// Server-side reads use the anon key too - RLS policies (see supabase/schema.sql)
// already scope public reads to active hotels / room types / rates / inventory,
// so no service-role key is needed for the guest-facing booking engine.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
