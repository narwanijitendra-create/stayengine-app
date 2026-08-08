import { NextResponse } from "next/server";

// Resolves shortened Google Maps share links (e.g. maps.app.goo.gl/xxxx)
// to their final URL so the client can pull out the lat/lon that Google
// Maps embeds in the resolved address. This has to happen server-side
// because the browser can't follow cross-origin redirects and read the
// resulting URL due to CORS.
export async function POST(req: Request) {
  let url: string | undefined;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid URL is required" }, { status: 400 });
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const allowedHosts = [
    "maps.app.goo.gl",
    "goo.gl",
    "google.com",
    "www.google.com",
    "maps.google.com",
  ];
  if (!allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return NextResponse.json({ error: "Only Google Maps links are supported" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    return NextResponse.json({ finalUrl: res.url });
  } catch {
    return NextResponse.json({ error: "Could not resolve that link" }, { status: 502 });
  }
}
