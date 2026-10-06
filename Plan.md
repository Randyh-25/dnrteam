# Social Media Dashboard Project Plan

## 1. Project Overview
A unified Next.js dashboard deployed on Vercel to monitor follower growth, engagement, and content performance across YouTube, Instagram, Facebook, Threads, and TikTok. Uses Firebase Firestore as both a caching layer (3-hour TTL) and a historical database for growth charts.

## 2. Tech Stack
*   **Framework:** Next.js 14+ (App Router)
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI (Card, Button, Skeleton, Sidebar, Tabs)
*   **Icons:** Lucide React
*   **Charts:** Recharts
*   **Backend / Caching:** Firebase Firestore (cache + historical snapshots)
*   **API Calls:** Fetch API via Next.js API Routes (to secure API keys). All external API calls go through server-side routes that check Firestore first.

## 3. UI/UX Analysis
*   **Theme:** Clean, modern, minimalistic interface with dark/light mode toggle.
*   **Layout:**
    *   **Sidebar:** Navigation menu (Overview, Platforms, Settings).
    *   **Header:** Page title, last updated timestamp, refresh button.
    *   **Main Content Area:** 
        *   **Top Row:** Summary KPI Cards (Total Audience across all platforms).
        *   **Middle Row:** Individual Platform Cards (Icon, Follower Count, 24h/7d Growth Trend, Status Badge - Online/Error).
        *   **Bottom Row:** Analytics Chart (Combined timeline of follower growth).
*   **UX Considerations:**
    *   **Loading States:** Use Skeleton loaders while fetching API data.
    *   **Error Handling:** If an API fails (e.g., token expired), show a clear error badge on that specific platform card without breaking the whole dashboard.
    *   **Responsiveness:** Grid layout must stack elegantly on mobile devices.

## 4. API Strategy
*   **YouTube:** YouTube Data API v3 (Direct API Key).
*   **Meta (Instagram, Facebook, Threads):** Meta Graph API (Long-lived Access Token).
*   **TikTok:** RapidAPI / Apify Aggregator (API Key for third-party).

## 5. Firestore Caching & History Strategy
All API routes follow this logic:
1.  **Check Firestore** for a cached document matching the platform + today's date.
2.  If the document exists **and** its `updatedAt` timestamp is **less than 3 hours old** → return cached data immediately.
3.  If the document is **older than 3 hours** or **does not exist** → fetch fresh data from the external Social Media API.
4.  **Save** the new payload to Firestore with a fresh `updatedAt` timestamp.
5.  **Return** the fresh data to the client.

Each daily snapshot is also preserved as a historical record, enabling growth charts over time.

---

## 6. Implementation Plan & Progress Checklist
*AI Agent Instructions: Read this checklist before starting any task. When a task is completed, change `[ ]` to `[x]` and update this file.*

### Phase 1: Foundation & UI Shell
- [x] Initialize Next.js project with Tailwind CSS and TypeScript.
- [x] Install dependencies (lucide-react, recharts, shadcn/ui components).
- [x] Set up Firebase: install `firebase` and `firebase-admin`, create `lib/firebase.ts` with Firestore initialization.
- [x] Create `.env.example` with all required environment variables (including Firebase).
- [x] Create layout structure (Sidebar, Header, Main Content).
- [x] Build mock UI (KPI Cards, Platform Cards, Line Chart) with hardcoded data.

### Phase 2: YouTube Integration
- [x] Create API route `app/api/youtube/route.ts`.
- [x] Implement fetch to YouTube Data API using `YOUTUBE_API_KEY`.
- [x] Connect YouTube UI card to the live endpoint.
- [x] Add loading skeleton and error boundary.

### Phase 3: Firestore Caching Layer
- [x] Create a shared utility `lib/firestore-cache.ts` implementing the 3-hour TTL caching logic.
- [x] Integrate caching utility into the YouTube API route (read/write Firestore).
- [x] Verify cached data is returned when within the 3-hour window.
- [x] Verify fresh data is fetched and saved when cache is stale or missing.

### Phase 4: Meta Integration (IG, FB, Threads)
- [x] Create API route `app/api/meta/route.ts`.
- [x] Implement fetch to Meta Graph API for FB Page and IG Business Account using `META_ACCESS_TOKEN`.
- [x] Implement fetch to Threads API endpoint.
- [x] Connect Meta UI cards to the live endpoints.
- [x] Integrate Firestore caching into Meta API route.

### Phase 5: TikTok Integration (Aggregator)
- [x] Create API route `app/api/tiktok/route.ts`.
- [x] Implement fetch to RapidAPI TikTok aggregator using `RAPIDAPI_KEY`.
- [x] Connect TikTok UI card to the live endpoint.
- [x] Integrate Firestore caching into TikTok API route.

### Phase 6: Final Polish & Deployment
- [x] Implement global "Refresh All Data" button (force-invalidates Firestore cache).
- [x] Build historical growth chart using Firestore daily snapshots.
- [x] Final responsive / dark-mode QA pass.
- [ ] Deploy to Vercel and map environment variables.