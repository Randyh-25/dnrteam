# DNR Team — Social Media Dashboard

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
| `META_ACCESS_TOKEN` | Long-lived token for Facebook / Instagram / Threads |
| `FB_PAGE_ID`, `IG_USER_ID`, `THREADS_USER_ID` | Meta resource IDs |
| `RAPIDAPI_KEY`, `TIKTOK_USERNAME` | TikTok via RapidAPI aggregator |
| `RAPIDAPI_TIKTOK_HOST` | Optional aggregator host override |
| `REVALIDATE_TIME` | Cache TTL in seconds (defaults to `10800` = 3h) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin service account |

The app degrades gracefully: if a credential is missing or a platform API
errors, only that platform's card shows an error badge. If Firebase is not
configured, the app runs in no-cache mode.

## API routes

| Route | Description |
| --- | --- |
| `GET /api/dashboard` | Aggregated platform stats + KPI totals (used by the UI) |
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
4. Each fresh fetch also upserts a `snapshots/{platform}_{YYYY-MM-DD}` document,
   which `/api/history` pivots into the growth chart.

A composite index on `snapshots(platform ASC, date ASC)` is required; it is
declared in [`firestore.indexes.json`](./firestore.indexes.json).

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
3. Create the Firestore composite index (Firebase Console → Firestore → Indexes,
   or `firebase deploy --only firestore:indexes`).
4. Deploy — the API routes run on the Node.js runtime and auto-scale.
