# Gen Tyz — Social Media Dashboard

A unified Next.js dashboard for monitoring follower growth, engagement, and
content performance across **YouTube, Instagram, Facebook, Threads, and
TikTok**. Firestore acts as both a 3-hour cache and a historical database that
powers growth charts.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4** with a shadcn-style component/design system
- **Recharts** for the combined growth timeline
- **Lucide React** icons (plus inline brand marks)
- **Firebase Admin / Firestore** for caching + daily snapshots
- Server-side API routes for every external call (keys never reach the client)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See [`.env.example`](./.env.example) for the full list:

| Variable | Purpose |
| --- | --- |
| `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` | YouTube Data API v3 (channel ID, legacy username, or `@handle`) |
| `RAPIDAPI_KEY` | Single RapidAPI key shared by Instagram / Facebook / Threads / TikTok |
| `RAPIDAPI_HOST_INSTAGRAM`, `RAPIDAPI_HOST_FACEBOOK` | RapidAPI vendors for IG / FB |
| `RAPIDAPI_HOST_THREADS`, `RAPIDAPI_HOST_TIKTOK` | RapidAPI vendors for Threads / TikTok |
| `INSTAGRAM_USERNAME`, `FACEBOOK_PROFILE_URL`, `THREADS_USERNAME`, `TIKTOK_USERNAME` | Accounts to look up (FB accepts a public profile or page URL) |
| `REVALIDATE_TIME` | Cache TTL in seconds (defaults to `10800` = 3h) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin service account |

The app degrades gracefully: if a credential is missing or a platform API
errors, only that platform's card shows an error badge. If Firebase is not
configured, the app runs in no-cache mode.

## API routes

| Route | Description |
| --- | --- |
| `GET /api/stats` | **Historical analytics**: `social_stats/{YYYY-MM-DD}` cache → fresh fetch → returns `{ current, previous, growth }` day-over-day comparison |
| `GET /api/analytics?days=30[&platform=]` | **Per-platform analytics**: full metric timeline + latest values + windowed change |
| `GET /api/dashboard` | Per-platform stats + KPI totals (used by the UI) |
| `GET /api/history?days=30` | Pivoted daily snapshots for the growth chart |
| `GET /api/youtube` | YouTube channel stats |
| `GET /api/meta[?platform=]` | Facebook / Instagram / Threads stats |
| `GET /api/tiktok` | TikTok profile stats |

Add `?force=1` to bypass the Firestore cache (the header's **Refresh** button
does this across all routes).

## Caching & history

Every route follows the same flow:

1. Read `cache/{platform}` from Firestore.
2. If it exists and `updatedAt` is younger than the TTL → return it.
3. Otherwise fetch fresh data, then persist it.
4. Each fresh fetch also upserts a daily snapshot under
   `snapshots/{platform}/days/{YYYY-MM-DD}`, which `/api/history` pivots into
   the growth chart.

Snapshots are stored as a per-platform subcollection so the range query uses
Firestore's automatic single-field index — **no composite index needs to be
created manually**.

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build
npm run lint    # ESLint
npm test        # unit tests (cache/growth logic)
```

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel.
2. Add every variable from `.env.example` in **Project → Settings → Environment
   Variables** (use the real service-account values).
3. Deploy — the API routes run on the Node.js runtime and auto-scale.
