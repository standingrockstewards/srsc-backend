# Standing Rock Stewardship Co. — Field Operations Platform

A full-stack React web application for lake property monitoring and stewardship field operations at Lake Eufaula, Oklahoma.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS v3 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Backend | Express.js (Node.js) |
| Database (local) | SQLite via Drizzle ORM (better-sqlite3) |
| Database (production) | Supabase (PostgreSQL + Edge Functions + pg_cron) |
| PDF Export | jsPDF |
| Email | Resend |
| Monitoring Integration | Minut (webhook + device sync) |
| Offline | IndexedDB (auto-save drafts every 30s) |

---

## User Roles

| Role | Access |
|---|---|
| **Admin** | Full access — all properties, all data, Signal Flare dashboard, escalation log, staff management |
| **Field Tech** | Assigned properties, checklist execution, visit history |
| **Client** | Read-only portal — own property status, reports, daily digest timeline, AAR downloads |

---

## Service Tiers

| Tier | Pricing |
|---|---|
| Anchor Watch | $99/mo |
| Anchor Watch Plus | $179/mo |
| Shipshape | $399/mo |
| Launch Crew | $85/hr |
| Signal Flare — Small | $325 install + $69/mo |
| Signal Flare — Standard | $475 install + $99/mo |
| Signal Flare — Heavy | $649 install + $159/mo |

Signal Flare properties have active Minut sensor devices and receive the full automation layer (real-time alerts, escalation emails, and daily digest reports).

---

## 1. Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- npm 9+

### Install & Run

```bash
cd srsc-app
npm install
npm run dev     # starts on port 5000
```

This starts the full-stack server at **http://localhost:5000** — both the Express API and the Vite frontend run on the same port.

The SQLite database (`data.db`) is auto-created on first run with seed data including demo users and sample properties. No environment variables are required for local development.

### Demo Credentials

| Role | Username | Password | Access |
|---|---|---|---|
| Admin | `admin` | `admin123` | Full access — all properties, all data |
| Field Tech | `jake` | `jake123` | Assigned properties, checklist execution |
| Field Tech | `marcus` | `marcus123` | Assigned properties |
| Client | `jsmith` | `client123` | Smith Lake House — read-only portal |
| Client | `rhenderson` | `client123` | Henderson Retreat — read-only portal |
| Client | `apatel` | `client123` | Patel Cove Cabin — read-only portal |

---

## 2. Build & Deploy

### Build

```bash
npm run build
```

Built output:
- `dist/public/` — frontend static files
- `dist/index.cjs` — Express server bundle

### Run in Production

```bash
NODE_ENV=production node dist/index.cjs
```

Deploy the static files from `dist/public/` and run the backend server on port 5000.

### Hosting Options

**Option A: Vercel (Recommended)**

1. Push this repo to GitHub/GitLab
2. Import the project in [Vercel Dashboard](https://vercel.com)
3. Configure project settings:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`
4. Add environment variables (see section 3 below)
5. Deploy

> **Note on SQLite in production:** SQLite stores data in a local file (`data.db`) which does not persist across Vercel serverless function restarts. Use Supabase for production data persistence (see section 4).

**Option B: Railway / Render / Fly.io**

These platforms support persistent Node.js servers with file storage:

1. Connect your repo
2. Build command: `npm run build`
3. Start command: `NODE_ENV=production node dist/index.cjs`
4. Port: `5000`
5. SQLite persists normally on persistent VMs

---

## 3. Environment Variables

### Local Development

No environment variables required. The app runs entirely on SQLite with no external services.

### Production — Required for Signal Flare Automation Layer

| Variable | Description | Where to get it |
|---|---|---|
| `RESEND_API_KEY` | Resend email API key | resend.com → API Keys |
| `MINUT_WEBHOOK_SECRET` | Minut webhook signing secret | Minut Dashboard → Webhooks → Your webhook → Secret |
| `APP_URL` | Live production URL (no trailing slash) | Your Vercel/hosting URL, e.g. `https://app.standingrockstewards.com` |
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key | Supabase Dashboard → Project Settings → API |
| `SUPABASE_URL` | Same as above (server-side / edge functions) | Same source |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Project Settings → API |

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` must never be exposed client-side.** It is used only in Supabase Edge Functions and server-side code.

**Vercel environment variable settings:**
- `VITE_` prefixed variables must be added to Vercel's environment settings — they get bundled into the frontend build.
- Server-only variables (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MINUT_WEBHOOK_SECRET`) go into Supabase Edge Function environment settings via `supabase secrets set`.

---

## 4. Supabase Setup (First Time)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL**, **anon public key**, and **service role key** from Project Settings → API

### Step 2: Run Initial Schema

In the Supabase SQL Editor, run the full schema SQL (covers all existing tables with RLS enabled). This creates the core tables: `users`, `properties`, `visits`, `visit_photos`, `vendor_dispatches`, `recommendations`, `scheduled_visits`, and `monitoring_devices`.

### Step 3: Run Schema Additions (Signal Flare Automation Layer)

Run `/supabase/schema-additions.sql` in the Supabase SQL Editor.

This migration adds:
- `notification_preferences` column on `properties`
- `account_manager_id` column on `properties`
- `minut_device_id` column on `monitoring_devices`
- New table: `escalation_log`
- New table: `daily_digests`

### Step 4: Enable pg_cron Extension

In the Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Then run the pg_cron schedule commands found at the bottom of `schema-additions.sql`, replacing `[PROJECT_REF]` and `[SERVICE_ROLE_KEY]` with your actual values before executing.

### Step 5: Enable Real-Time

In Supabase Dashboard → Database → Replication, enable replication for:
- `alert_events`
- `monitoring_devices`

This powers the live-updating Signal Flare dashboard without polling.

---

## 5. Supabase Edge Functions Deployment

The Signal Flare Automation Layer runs as three Supabase Edge Functions.

```bash
# Install Supabase CLI
npm install -g supabase

# Authenticate
supabase login

# Link to your project
supabase link --project-ref [PROJECT_REF]

# Set environment variables for Edge Functions
supabase secrets set RESEND_API_KEY=your_key_here
supabase secrets set MINUT_WEBHOOK_SECRET=your_secret_here
supabase secrets set APP_URL=https://your-app-url.com

# Deploy all three functions
supabase functions deploy minut-webhook
supabase functions deploy process-escalations
supabase functions deploy generate-daily-digests
```

Your Minut webhook endpoint (give this URL to Minut):
```
https://[PROJECT_REF].supabase.co/functions/v1/minut-webhook
```

---

## 6. Minut Webhook Configuration

1. Log in to your Minut dashboard at [minut.com](https://minut.com)
2. Go to **Settings → Webhooks** (or **API → Webhooks** depending on your plan)
3. Click **Add Webhook**
4. Set the URL to:
   ```
   https://[PROJECT_REF].supabase.co/functions/v1/minut-webhook
   ```
5. Select all events to send: **Motion, Sound, Temperature, Humidity, Smoke/CO, Device Offline**
6. Copy the **Webhook Secret** that Minut generates
7. Register that secret with Supabase:
   ```bash
   supabase secrets set MINUT_WEBHOOK_SECRET=your_minut_secret
   ```
8. In the app, open each monitoring device for a Minut sensor and fill in the **Minut Device ID** field. The device ID is found in the Minut dashboard under Devices → select device → Device ID.

---

## 7. Resend Email Setup

1. Create an account at [resend.com](https://resend.com)
2. Add your domain: **standingrockstewards.com** → Domains → Add Domain
3. Follow the DNS verification steps (add TXT and MX records at your domain registrar)
4. Wait for verification (typically 5–30 minutes)
5. Create an API Key → copy it and set as `RESEND_API_KEY`
6. Emails will send from: `reports@standingrockstewards.com`

> ⚠️ Until domain verification is complete, Resend will reject outbound sends. You can test with the Resend-provided sandbox address first.

---

## 8. pg_cron Schedule Overview

These jobs are registered in Supabase via the commands at the bottom of `schema-additions.sql`.

| Job | Schedule | What it does |
|---|---|---|
| `process-escalations` | Every 5 minutes | Checks unresolved Emergency/High alerts past threshold → sends escalation email to the assigned account manager |
| `daily-digest` | Daily at 11:59 PM CST (04:59 UTC) | Compiles a daily activity summary for each Signal Flare property and stores it in `daily_digests` |
| `offline-detection` | Every 15 minutes | Marks devices `Offline` if `last_ping` is more than 30 minutes ago |

---

## 9. Account Manager Assignment

For each Signal Flare property, an account manager must be assigned to receive escalation emails.

1. Admin → Properties → select the property
2. Click **Edit Property**
3. Set **Account Manager** to the responsible team member
4. Configure escalation thresholds (defaults: Emergency = 15 min, High = 60 min)

The assigned account manager will receive an escalation email whenever an alert is not acknowledged within the configured threshold. Escalation history is viewable at Admin → Escalation Log.

---

## 10. Project Structure

```
srsc-app/
├── client/src/
│   ├── App.tsx                          # Root — routing + auth gating
│   ├── lib/
│   │   ├── auth.tsx                     # Auth context + session management
│   │   ├── checklist.ts                 # All checklist module definitions
│   │   ├── offline.ts                   # IndexedDB draft save/load + image compression
│   │   ├── pdf.ts                       # jsPDF — After Action Report generator
│   │   ├── queryClient.ts               # TanStack Query + fetch helpers
│   │   └── realtime.ts                  # NEW: Supabase real-time subscriptions
│   ├── components/
│   │   ├── app-layout.tsx               # Sidebar layout (Admin + Tech variants)
│   │   ├── status-badge.tsx             # Status/tier/priority/role badge components
│   │   └── ui/                          # shadcn/ui components
│   └── pages/
│       ├── login.tsx
│       ├── not-found.tsx
│       ├── admin/
│       │   ├── dashboard.tsx            # KPI cards, activity feed
│       │   ├── properties.tsx           # Property list + add dialog
│       │   ├── property-detail.tsx      # Tabs: overview, visits, action items
│       │   ├── visit-detail.tsx         # Full visit report + AAR download
│       │   ├── users.tsx                # Staff management
│       │   ├── signal-flare-dashboard.tsx  # Monitoring dashboard (real-time)
│       │   └── escalation-log.tsx       # NEW: escalation history
│       ├── tech/
│       │   ├── dashboard.tsx            # Today's visits, assigned properties
│       │   ├── visits.tsx               # My visit history
│       │   └── visit-flow.tsx           # Dynamic checklist → submit → PDF
│       └── client/
│           └── portal.tsx               # Read-only: status + reports + daily digest timeline
├── server/
│   ├── index.ts                         # Express entry point
│   ├── routes.ts                        # API endpoints
│   └── storage.ts                       # Drizzle ORM data layer
├── shared/
│   └── schema.ts                        # Drizzle table definitions + TypeScript types
└── supabase/
    ├── schema-additions.sql             # NEW: additive schema changes (Signal Flare layer)
    └── functions/
        ├── minut-webhook/
        │   └── index.ts                 # NEW: Minut webhook receiver
        ├── process-escalations/
        │   └── index.ts                 # NEW: escalation processor (pg_cron)
        └── generate-daily-digests/
            └── index.ts                 # NEW: daily digest generator (pg_cron)
```

---

## Key Features

### Checklist Engine
- 10 modules: Exterior, Security, Summary + 7 conditional modules (Dock, Watercraft, Boat Lift, Interior, Generator, Propane, Irrigation)
- Pass / Flag / Fail selector with large touch targets (mobile-optimized)
- Per-item notes field
- Camera capture with automatic image compression (JPEG, max 1200px, 70% quality)
- Module visibility driven by per-property feature flags

### Offline Support
- Checklist auto-saves to IndexedDB every 30 seconds
- Fully functional offline — submit syncs when connection is restored
- Offline indicator badge when disconnected

### After Action Report (AAR) PDF
- Auto-generated on demand via jsPDF
- Branded header (navy + gold) and footer on every page
- Section-by-section checklist results (color-coded: green / amber / red)
- Embedded photos per checklist item
- Vendor dispatches and recommendations with priority
- Billing summary (labor + materials + mileage at $0.67/mi)
- Technician digital signature + date
- Downloadable from admin visit detail and client portal

### Signal Flare Automation Layer
- Real-time alert feed via Supabase Realtime subscriptions
- Minut webhook receiver validates signatures and writes `alert_events`
- Escalation processor runs every 5 minutes via pg_cron; sends email via Resend when alerts exceed threshold
- Daily digest generator compiles property activity summaries nightly and surfaces them in the client portal
- Offline device detection marks devices stale after 30 minutes without a ping

### Security
- Sensitive fields (alarm codes, access notes) masked in UI with reveal toggle
- Role-based routing — field techs cannot access admin views; clients see only their property
- Server-side filtering — API returns only authorized data per role
- `SUPABASE_SERVICE_ROLE_KEY` used only server-side / in Edge Functions, never in client bundle

---

## Contact

**Standing Rock Stewardship Co.**  
(918) 707-2228  
standingrockstewards.com  
Lake Eufaula, Oklahoma
