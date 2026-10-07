import { NextResponse, type NextRequest } from "next/server";
import { getDefaultOwnerId } from "@/lib/oauth/session";
import { getPlatformDetail } from "@/lib/normalize/platform-detail";
import { getSnapshots } from "@/lib/firestore-cache";
import { buildReport } from "@/lib/report/build";
import type { RawSnapshot } from "@/lib/firestore-cache";
import type { NormalizedPlatformDetail } from "@/lib/normalize/types";
import type { PlatformKey } from "@/lib/types";
import type { ReportMetric, ReportRange } from "@/lib/report/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SUPPORTED: PlatformKey[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

const ALL_METRICS: ReportMetric[] = [
  "followers",
  "views",
  "content",
  "likes",
  "comments",
  "shares",
  "engagement",
  "growth",
];

/**
 * POST /api/report
 *
 * Body: { range, from?, to?, platforms[], metrics[], days? }
 *
 * Assembles a report from the SAME normalized detail + snapshot data the
 * dashboard uses. Platforms without a connected account are skipped (and noted)
 * so one missing connection never fails the whole report.
 */
export async function POST(request: NextRequest) {
  let body: {
    range?: ReportRange;
    from?: string;
    to?: string;
    days?: number;
    platforms?: string[];
    metrics?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platforms = (body.platforms && body.platforms.length > 0
    ? body.platforms
    : SUPPORTED
  ).filter((p): p is PlatformKey => SUPPORTED.includes(p as PlatformKey));

  const metrics = (body.metrics && body.metrics.length > 0
    ? body.metrics
    : ALL_METRICS
  ).filter((m): m is ReportMetric => ALL_METRICS.includes(m as ReportMetric));

  const days = resolveDays(body);

  const ownerId = getDefaultOwnerId();

  // Fetch normalized detail per platform (skipping disconnected ones).
  const detailResults = await Promise.all(
    platforms.map((platform) =>
      getPlatformDetail({ ownerId, platform, limit: 20 })
    )
  );

  const details: NormalizedPlatformDetail[] = [];
  const skipped: string[] = [];
  detailResults.forEach((result, index) => {
    if (result.status === "ok") {
      details.push(result.data);
    } else {
      skipped.push(`${platforms[index]}: ${result.status}`);
    }
  });

  // Historical snapshots for the range (drives growth charts).
  const snapshotPairs = await Promise.all(
    details.map(async (detail) => {
      const snaps = await getSnapshots(detail.platform, days);
      return [detail.platform, snaps] as const;
    })
  );
  const snapshotsByPlatform: Record<string, RawSnapshot[]> = {};
  for (const [platform, snaps] of snapshotPairs) {
    snapshotsByPlatform[platform] = snaps;
  }

  const report = buildReport({
    title: "Social Media Performance Report",
    periodLabel: periodLabel(body, days),
    platforms: details.map((d) => d.platform),
    metrics,
    details,
    snapshotsByPlatform,
  });

  return NextResponse.json(
    { report, skipped },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Resolves the number of days for the analytics/snapshot window. */
function resolveDays(body: {
  range?: ReportRange;
  from?: string;
  to?: string;
  days?: number;
}): number {
  if (body.range === "custom" && body.from && body.to) {
    const from = Date.parse(body.from);
    const to = Date.parse(body.to);
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
      return Math.max(1, Math.min(365, Math.round((to - from) / 86400000) + 1));
    }
  }
  if (typeof body.days === "number" && body.days > 0) {
    return Math.min(365, Math.round(body.days));
  }
  switch (body.range) {
    case "7":
      return 7;
    case "90":
      return 90;
    case "30":
    default:
      return 30;
  }
}

function periodLabel(
  body: { range?: ReportRange; from?: string; to?: string },
  days: number
): string {
  if (body.range === "custom" && body.from && body.to) {
    return `${body.from} → ${body.to}`;
  }
  return `Last ${days} days`;
}
