import type { PlatformKey, PlatformStats } from "@/lib/types";
import {
  attachGrowth,
  getCachedPlatform,
  getStalePlatform,
  setPlatform,
} from "@/lib/firestore-cache";

/**
 * Runs the shared "check cache → fetch fresh → persist" flow for a single
 * platform, following PLAN.md §5.
 *
 * If the upstream fetch fails but stale cached data exists, the stale data is
 * returned (flagged as cached) rather than a hard error — that keeps the
 * dashboard usable when a token expires.
 */
export async function resolvePlatform(
  platform: PlatformKey,
  fetcher: () => Promise<PlatformStats>,
  options: { force?: boolean } = {}
): Promise<PlatformStats> {
  if (!options.force) {
    const cached = await getCachedPlatform(platform);
    if (cached) return cached.data;
  }

  const fresh = await fetcher();

  if (fresh.status === "error") {
    const stale = await getStalePlatform(platform);
    if (stale) {
      return { ...stale.data, cached: true };
    }
    return fresh;
  }

  const enriched = await attachGrowth(fresh);
  await setPlatform(platform, enriched);
  return { ...enriched, cached: false };
}
