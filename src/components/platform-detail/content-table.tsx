"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, ImageOff } from "lucide-react";
import { formatCompact } from "@/lib/format";
import type { NormalizedContent } from "@/lib/normalize/types";

type SortKey =
  | "newest"
  | "views"
  | "likes"
  | "comments"
  | "engagement";

interface ContentTableProps {
  content: NormalizedContent[];
  support: {
    views: boolean;
    likes: boolean;
    comments: boolean;
    shares: boolean;
  };
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "views", label: "Most views" },
  { key: "likes", label: "Most likes" },
  { key: "comments", label: "Most comments" },
  { key: "engagement", label: "Highest engagement" },
];

function fmt(value: number | null): string {
  return value === null ? "N/A" : formatCompact(value);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Recent content with client-side sorting. On small screens it renders as
 * cards; on `md+` it renders as a scrollable table. Unavailable metrics show
 * "N/A" rather than a fabricated value.
 */
export function ContentTable({
  content,
  support,
  onLoadMore,
  loadingMore,
}: ContentTableProps) {
  const [sort, setSort] = useState<SortKey>("newest");

  const sorted = useMemo(() => {
    const copy = [...content];
    const val = (c: NormalizedContent, k: SortKey): number => {
      switch (k) {
        case "views":
          return c.views ?? -1;
        case "likes":
          return c.likes ?? -1;
        case "comments":
          return c.comments ?? -1;
        case "engagement":
          return c.engagementRate ?? -1;
        case "newest":
        default:
          return c.publishedAt ? Date.parse(c.publishedAt) : 0;
      }
    };
    copy.sort((a, b) => val(b, sort) - val(a, sort));
    return copy;
  }, [content, sort]);

  if (content.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground">
          No content could be retrieved for this account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sorting */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              sort === s.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Content</th>
              <th className="text-left font-medium px-3 py-2">Date</th>
              <th className="text-right font-medium px-3 py-2">Views</th>
              <th className="text-right font-medium px-3 py-2">Likes</th>
              <th className="text-right font-medium px-3 py-2">Comments</th>
              {support.shares && (
                <th className="text-right font-medium px-3 py-2">Shares</th>
              )}
              <th className="text-right font-medium px-3 py-2">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.id}
                className="border-t border-border hover:bg-accent/30 transition-colors"
              >
                <td className="px-3 py-2 max-w-[320px]">
                  <div className="flex items-center gap-2">
                    {c.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="w-12 h-9 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                        <ImageOff className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-primary inline-flex items-center gap-1"
                        >
                          <span className="truncate max-w-[240px]">
                            {c.title || c.caption || c.id}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="truncate max-w-[240px] block">
                          {c.title || c.caption || c.id}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {c.contentType}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {fmtDate(c.publishedAt)}
                </td>
                <td className="px-3 py-2 text-right">{fmt(c.views)}</td>
                <td className="px-3 py-2 text-right">{fmt(c.likes)}</td>
                <td className="px-3 py-2 text-right">{fmt(c.comments)}</td>
                {support.shares && (
                  <td className="px-3 py-2 text-right">{fmt(c.shares)}</td>
                )}
                <td className="px-3 py-2 text-right">
                  {c.engagementRate === null
                    ? "N/A"
                    : `${c.engagementRate}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.map((c) => (
          <a
            key={c.id}
            href={c.url ?? undefined}
            target={c.url ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="flex gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
          >
            {c.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.thumbnailUrl}
                alt=""
                className="w-16 h-12 rounded object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                <ImageOff className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">
                {c.title || c.caption || c.id}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {fmtDate(c.publishedAt)} · {c.contentType}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Views {fmt(c.views)} · Likes {fmt(c.likes)} · Comments{" "}
                {fmt(c.comments)}
              </p>
            </div>
          </a>
        ))}
      </div>

      {onLoadMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
