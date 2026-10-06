/** Number/percent formatting helpers shared by the dashboard components. */

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (abs >= 1_000)
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(value));
}

export function formatPercent(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
