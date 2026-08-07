import { NextRequest, NextResponse } from "next/server";

// Resolves which hotel a request is for, based on the hostname, then
// rewrites the request internally to /sites/[slug]/... so a single
// codebase serves every hotel's booking engine.
//
// Supports all three delivery models from the plan:
//  - subdomain:      riverside-inn.stayengine.app  -> slug from the hostname directly (no DB call, fast)
//  - custom domain:  booking.riverside-inn.com     -> looked up against hotels.custom_domain
//  - widget:         /widget/[slug] is a normal route, not touched by this middleware
//
// Platform-owned paths (admin, marketing home, widget, api, static assets)
// are never rewritten, regardless of which host they're requested on.

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "stayengine.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const config = {
  matcher: ["/((?!_next|api|widget|admin|favicon.ico|robots.txt).*)"],
};

async function lookupSlugByCustomDomain(host: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/hotels?select=slug&custom_domain=eq.${encodeURIComponent(host)}&status=eq.active`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await res.json();
    return rows?.[0]?.slug ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // Root domain itself (marketing page) or bare localhost during local dev - no rewrite.
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}` || hostname === "localhost" || hostname === "127.0.0.1") {
    return NextResponse.next();
  }

  // If the path already targets a platform-owned route (shouldn't normally
  // reach here given the matcher, but double-guarded), pass through.
  if (req.nextUrl.pathname.startsWith("/sites/")) {
    return NextResponse.next();
  }

  let slug: string | null = null;

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    // Subdomain model: {slug}.stayengine.app
    slug = hostname.replace(`.${ROOT_DOMAIN}`, "");
  } else {
    // Custom domain model: booking.theirhotel.com
    slug = await lookupSlugByCustomDomain(hostname);
  }

  if (!slug) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/sites/${slug}${req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}
