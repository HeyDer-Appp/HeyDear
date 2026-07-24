# HeyDer App

Full-stack web application for HeyDer — Auckland's weekly social dining company.

## Architecture

```
/
├── server/          Express + Firestore backend
├── client/          React + Tailwind CSS frontend
├── .env.example     Environment variable template
└── README.md
```

The server is a regular always-on Express app (deployed on Render) — not Firebase Cloud
Functions — because Stripe/Resend/Typeform all need outbound network calls the free
Spark plan's Functions can't make. Firebase is used for **Firestore** (data) and
**Firebase Auth** (email/password signup & login), both of which the server talks to
via the Admin SDK.

## Prerequisites

- Node.js 18+
- A Firebase project (Firestore + Authentication enabled, email/password sign-in method on)
- Stripe account
- Resend or SMTP email account
- Typeform personal access token (for historical data import)

## Quick Start

### 1. Clone and install

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Set up Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database** (production mode) and **Authentication → Sign-in method → Email/Password**
3. Project Settings → Service Accounts → **Generate new private key** — you'll need `project_id`, `client_email`, and `private_key` from the downloaded JSON for the server's `.env`
4. Project Settings → General → Your apps → add a Web app — you'll need `apiKey`, `authDomain`, `projectId`, `appId` for the client's `.env`

### 3. Configure environment

```bash
# Backend
cp .env.example server/.env
# Edit server/.env with your Firebase service account + Stripe/email values

# Frontend
cp client/.env.example client/.env
# Add your Firebase web app config + Stripe publishable key
```

### 4. Create admin account

Once the server is running, visit `/api/auth/admin/setup` with a POST request:
```bash
curl -X POST http://localhost:3001/api/auth/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@heyder.nz","password":"your-password","name":"Admin"}'
```
This creates a Firebase Auth user with the admin custom claim, plus an `admins/{uid}`
Firestore doc, and is **locked after first use**. From then on, existing admins can
create more via `POST /api/auth/admin/create` (requires an admin session).

### 5. Import Typeform data (first time only)

Set `TYPEFORM_API_KEY` and `TYPEFORM_FORM_ID=OAxjrKyW` in your `.env`, then:

```bash
cd server
npm run seed:typeform
```

Or from the admin dashboard → Dashboard → "Import Typeform Data" button.

### 6. Run locally

```bash
# Terminal 1 — Backend
cd server
npm run dev    # runs on port 3001

# Terminal 2 — Frontend
cd client
npm run dev    # runs on port 5173
```

Visit `http://localhost:5173`

**No real Firebase project yet?** Point the server at the [Firebase Local Emulator
Suite](https://firebase.google.com/docs/emulator-suite) instead — set
`FIRESTORE_EMULATOR_HOST=localhost:8080` and `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`
in `server/.env` (see the commented-out lines in `.env.example`), then run
`firebase emulators:start` alongside the server. Fully offline, no billing required.

## Environment Variables

See `.env.example` (and `client/.env.example`) for all variables.

### Required — server

| Variable | Description |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account client email |
| `FIREBASE_PRIVATE_KEY` | Service account private key (keep the `\n` escapes) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret (`whsec_...`) |

### Required — client

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_APP_ID` | Firebase web app config (public identifiers — access is enforced by Firestore rules and server-side token verification, not secrecy) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

### Email (choose one)

**Resend (recommended):**
```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
```

**SMTP:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@heyder.nz
SMTP_PASS=your-app-password
```

### Optional

| Variable | Description |
|---|---|
| `TYPEFORM_API_KEY` | For importing Typeform responses |
| `TYPEFORM_FORM_ID` | Default: `OAxjrKyW` |
| `CLIENT_URL` | Frontend URL (default: `http://localhost:5173`) |

## Stripe Setup

1. Create a Stripe account at stripe.com
2. Set up a webhook pointing to `https://your-domain.com/api/payments/webhook`
3. Add these webhook events: `checkout.session.completed`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

## Deployment on Render

`render.yaml` describes both services. In the Render dashboard, fill in the
`sync: false` env vars (Firebase service account fields, Stripe keys, email
provider key, Firebase web app config) — they're left blank in the file on
purpose so secrets never end up committed to the repo.

## Admin Usage

### Weekly Matching Workflow (every Sunday)

1. Go to **Admin → Matching**
2. Select the upcoming Tuesday dinner
3. Drag people from the **Unmatched Pool** into **Table** columns
4. Watch live warnings:
   - 🔴 Red = gender ratio outside acceptable range, age range > 10 years
   - 🟡 Yellow = reliability gap > 4 points, mixed intent
5. Click **Confirm Table** when happy with a grouping
6. Send **Group Found** emails from the confirmed table
7. Set unique facts for each person before sending **Group Glimpse** (48hrs before)
8. Send **Venue Reveal** (24hrs before) after adding restaurant details

### Email Sequence

| Email | When | Trigger |
|---|---|---|
| Confirmation | Immediately on signup | Automatic |
| Group Found | After matching confirmed | Manual from Matching workspace |
| Group Glimpse | 48 hours before dinner | Manual from Matching workspace |
| Venue Reveal | 24 hours before dinner | Manual from Matching workspace |
| Reminder | Morning of dinner | Manual from Matching workspace |
| Post-dinner Feedback | Next morning | Manual from Matching workspace |

## Features

- **Public website** — pixel-perfect match of heyder.nz
- **Profile-building flow** — sign up, then build your HeyDer profile (replaces the old "quiz" framing)
- **Stripe payments** — one-time booking fee or monthly membership
- **Admin matching workspace** — drag-and-drop kanban with live warnings
- **Email system** — 6 branded email types
- **Attendee portal** — view bookings, update dietary, cancel
- **Analytics** — gender split, age distribution, NPS, retention
- **Ambassador management** — referral codes and tracking
- **Feedback system** — post-dinner survey with testimonial approval

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Vite, React Router, Recharts, Framer Motion, Firebase (client SDK)
- **Backend**: Node.js, Express, Firestore (firebase-admin)
- **Auth**: Firebase Authentication (email/password), custom claim for admin role
- **Payments**: Stripe
- **Email**: Resend or Nodemailer
- **Typeform**: REST API for question sync and historical import
