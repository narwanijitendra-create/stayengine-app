// Minimal wrapper around the Resend API (https://resend.com) for sending
// transactional emails. Uses plain fetch rather than the Resend SDK to avoid
// an extra dependency for what's currently a single email type.
//
// Requires the RESEND_API_KEY env var (set in Netlify). Optionally
// RESEND_FROM_EMAIL can override the sender (defaults to a fallback that
// only works once a sending domain is verified in Resend).
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet - silently no-op so order placement never fails
    // because of a missing/unset email integration.
    return { skipped: true as const };
  }

  const from = process.env.RESEND_FROM_EMAIL || "StayEngine <orders@oyeh.in>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend email failed:", res.status, text);
      return { error: text };
    }
    return { sent: true as const };
  } catch (err) {
    console.error("Resend email error:", err);
    return { error: String(err) };
  }
}
