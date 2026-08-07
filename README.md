# StayEngine — hotel booking engine MVP

A working multi-tenant booking engine: hotels get their own booking site on a
subdomain, a custom domain, or an embeddable widget, all from one codebase and
one Supabase database. This is the Phase 1 MVP from the architecture plan.

A demo hotel ("The Riverside Inn", slug `riverside-inn`) is already seeded in
the connected Supabase project with 3 room types and 90 days of inventory, so
you can see it working immediately.

## What's included

- Guest-facing booking engine: search, room selection, checkout, booking
  confirmation (`app/sites/[slug]`)
- Embeddable widget: `public/widget.js` + `app/widget/[slug]` (iframe target)
- Hotel admin dashboard: login, bookings list, room types, basic metrics
  (`app/admin`)
- Multi-tenant middleware that resolves subdomain or custom domain to a hotel
  and rewrites the request internally (`middleware.ts`)
- Supabase schema with row-level security so each hotel only ever sees its
  own data (already applied to your Supabase project — see below)

Payments are stubbed (booking is created directly on "Confirm and pay"). Wire
up Stripe Connect in `app/sites/[slug]/actions.ts` before taking real money —
see Phase 2 in the plan.

## Your Supabase project

A dedicated project was created for this app (separate from your existing
catalogue-management project, to avoid mixing data):

- Project: `stayengine-hotel-booking`
- URL: `https://avnwxregfmlsferwlmvz.supabase.co`
- Schema: `hotels`, `hotel_users`, `room_types`, `rates`, `inventory`,
  `guests`, `bookings`, `coupons`, `subscriptions` — all with RLS enabled
- `.env.local` is already filled in with this project's URL and anon key

## Run it locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the marketing/root page, or
`http://localhost:3000/sites/riverside-inn` to preview the demo booking site
directly (this bypasses subdomain routing, useful for local testing).

To test real subdomain routing locally, add to `/etc/hosts`:

```
127.0.0.1 riverside-inn.localhost
```

then visit `http://riverside-inn.localhost:3000` — the middleware detects
this doesn't match `NEXT_PUBLIC_ROOT_DOMAIN` so in production it would use the
subdomain; for pure localhost testing the direct `/sites/[slug]` route is
simplest.

## Create your first hotel admin login

Staff accounts are Supabase Auth users linked to a hotel via `hotel_users`.
To create the owner login for the demo hotel:

1. In the Supabase dashboard → Authentication → Users → **Add user**, create
   an account (email + password).
2. Run this SQL in the Supabase SQL editor, swapping in the new user's UUID
   (shown in the Users list) and email:

```sql
insert into hotel_users (hotel_id, auth_user_id, role, email)
values (
  '11111111-1111-1111-1111-111111111111', -- Riverside Inn's id
  '<paste-the-new-auth-user-id-here>',
  'owner',
  '<same-email-as-above>'
);
```

3. Sign in at `/admin/login`.

When you onboard a real hotel, the same pattern applies: insert a row into
`hotels`, then a row into `hotel_users` for the owner.

## Deploying for real

- **Hosting**: Vercel is the easiest fit — it has first-class support for
  wildcard subdomains and per-tenant custom domains (Vercel's Domains API),
  which matches the multi-tenant model this app already assumes.
- **Wildcard subdomain**: point `*.yourdomain.com` at the Vercel project and
  set `NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com`.
- **Custom domains**: when a hotel wants `booking.theirhotel.com`, add it to
  their `hotels.custom_domain` column and register the domain with your
  hosting provider (Vercel's API can do this programmatically) so SSL is
  provisioned automatically.
- **Widget embed**: hotels add this to their own site:
  ```html
  <script src="https://yourdomain.com/widget.js" data-hotel="riverside-inn"></script>
  ```

## What's next (Phase 2, per the plan)

- Stripe Connect for real payments, split per hotel
- Coupons/add-ons UI in the admin dashboard (table already exists)
- Rate calendar editing (the `rates` table supports date-specific pricing;
  no UI yet)
- Subscription billing for hotels themselves (the `subscriptions` table is
  ready; hook up Stripe Billing)
- Staff roles beyond owner/staff, multi-property support for Pro tier
