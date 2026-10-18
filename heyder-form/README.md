# HeyDer quiz form (standalone)

A separate, self-contained copy of the HeyDer Typeform quiz (`form.typeform.com/to/OAxjrKyW`).
It has nothing to do with the HeyDer app code — own server, own folder.

- **Form**: same 22 questions, same order, one question per screen, same look (cream background, lettered pills, 0–10 scale, keyboard shortcuts).
- **Payment** (same as the Typeform): one-time "HeyDer Booking fee", NZ$9.00, embedded Stripe Checkout inside the page.
  Extras from the HeyDer app: coupon codes and "Skip for now" → "Pay now & save 10%". The app's monthly plan is off unless `SUBSCRIPTION_ENABLED=true`.
- **Branching** (same as the Typeform): Wellington is sent to its own Typeform, "None of the above" ends with the Auckland & Wellington message.
- **Google Sheet**: one row per person. A row is added when they submit, then the payment columns
  (status / plan / coupon / amount / Stripe session) are updated when they pay or skip.
  Statuses: `Pending payment`, `Paid`, `Skipped payment`, `Waitlist (outside Auckland/Wellington)`, `Paid (test mode)`.

## Run
```
cd heyder-form
npm install
cp .env.example .env     # fill in the values below
npm start                # http://localhost:3100
```
Without Stripe keys checkout runs in test mode (no charge; refused when `NODE_ENV=production`); without Sheet settings answers are only saved to `data/submissions.json`.

## Google Sheet setup (5 min)
1. Google Cloud Console → new project → enable **Google Sheets API**.
2. IAM → Service accounts → create one → Keys → Add key → JSON. Save it as `data/service-account.json`.
3. Create a Google Sheet, copy the ID from its URL, set `GOOGLE_SHEET_ID` in `.env`.
4. Click **Share** on the sheet and give the service account's `client_email` **Editor** access.
The `Responses` tab and header row are created automatically.

## Stripe setup
Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`. In Stripe → Developers → Webhooks add
`https://YOUR-DOMAIN/api/webhook` for `checkout.session.completed`, and put its secret in `STRIPE_WEBHOOK_SECRET`.
(The page also confirms payment itself, so the sheet updates even before the webhook is wired.)

## Coupons
Edit `coupons.json` (see `coupons.example.json`): `{ "CODE": { "discountPercent": 20, "type": "subscription" | "one_time", "expiresAt": "2026-12-31", "active": true } }`. `type` and `expiresAt` are optional.

## Deploy
Any Node host (Render, Railway, a VPS). Set the same env vars, set `BASE_URL` to the public URL.
It can then be linked or embedded (`<iframe>`) on heyder.nz.
