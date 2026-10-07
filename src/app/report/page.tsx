"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Header } from "@/components/header";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platform-meta";
import { formatCompact, formatDateTime } from "@/lib/format";
import { reportToCsv } from "@/lib/report/csv";
import type { PlatformKey } from "@/lib/types";
import type {
  GeneratedReport,
  ReportMetric,
  ReportRange,
} from "@/lib/report/types";

const RANGES: Array<{ value: ReportRange; label: string }> = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom" },
];

const METRICS: Array<{ value: ReportMetric; label: string }> = [
  { value: "followers", label: "Followers" },
  { value: "views", label: "Views" },
  { value: "content", label: "Content" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
  { value: "shares", label: "Shares" },
  { value: "engagement", label: "Engagement rate" },
  { value: "growth", label: "Growth" },
];

export default function ReportPage() {
  const [range, setRange] = useState<ReportRange>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [platforms, setPlatforms] = useState<PlatformKey[]>(PLATFORM_ORDER);
  const [metrics, setMetrics] = useState<ReportMetric[]>(
    METRICS.map((m) => m.value)
  );
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: PlatformKey) =>
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  const toggleMetric = (m: ReportMetric) =>
    setMetrics((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range,
          from: range === "custom" ? from : undefined,
          to: range === "custom" ? to : undefined,
          platforms,
          metrics,
        }),
      });
      const json = (await res.json()) as {
        report?: GeneratedReport;
        skipped?: string[];
        error?: string;
      };
      if (!res.ok || !json.report) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setReport(json.report);
      setSkipped(json.skipped ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!report) return;
    const csv = reportToCsv(report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `social-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen">
      <Header />

      <div className="p-4 sm:p-6 space-y-6">
        <div className="no-print">
          <h2 className="text-lg font-semibold text-foreground">
            Generate Report
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build a performance report from live connected-account data.
          </p>
        </div>

        {/* Controls */}
        <section className="glass-card rounded-xl p-5 space-y-4 no-print">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Date range
              </p>
              <div className="flex flex-wrap gap-1.5">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    aria-pressed={range === r.value}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      range === r.value
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {range === "custom" && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
                  />
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Platforms
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORM_ORDER.map((p) => {
                  const meta = PLATFORM_META[p];
                  const active = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Metrics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {METRICS.map((m) => {
                  const active = metrics.includes(m.value);
                  return (
                    <button
                      key={m.value}
                      onClick={() => toggleMetric(m.value)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={generate}
              disabled={loading || platforms.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate Report"}
            </button>
            {report && (
              <>
                <button
                  onClick={downloadCsv}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-accent"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-accent"
                >
                  Print / PDF
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        {report && (
          <ReportView report={report} skipped={skipped} />
        )}
      </div>
    </main>
  );
}

function ReportView({
  report,
  skipped,
}: {
  report: GeneratedReport;
  skipped: string[];
}) {
  return (
    <article className="space-y-6 print-area">
      {/* Header */}
      <header className="glass-card rounded-xl p-5">
        <h1 className="text-xl font-bold text-foreground">{report.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Period: {report.periodLabel} · Generated{" "}
          {formatDateTime(report.generatedAt)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Platforms: {report.platforms.join(", ") || "none"}
        </p>
      </header>

      {skipped.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          Skipped (not connected or errored): {skipped.join(", ")}
        </div>
      )}

      {/* Executive summary */}
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">
          Executive Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Total audience" value={formatCompact(report.executiveSummary.totalAudience)} />
          <Stat label="Total views" value={formatCompact(report.executiveSummary.totalViews)} />
          <Stat label="Total content" value={formatCompact(report.executiveSummary.totalContent)} />
          <Stat label="Total engagement" value={formatCompact(report.executiveSummary.totalEngagement)} />
          <Stat
            label="Overall growth"
            value={
              report.executiveSummary.overallGrowth === null
                ? "N/A"
                : `${report.executiveSummary.overallGrowth}%`
            }
          />
        </div>
      </section>

      {/* Platform comparison */}
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">
          Platform Comparison
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Platform</th>
                <th className="text-left font-medium px-3 py-2">Account</th>
                <th className="text-right font-medium px-3 py-2">Followers</th>
                <th className="text-right font-medium px-3 py-2">Views</th>
                <th className="text-right font-medium px-3 py-2">Content</th>
                <th className="text-right font-medium px-3 py-2">Likes</th>
                <th className="text-right font-medium px-3 py-2">Comments</th>
                <th className="text-right font-medium px-3 py-2">Engagement</th>
                <th className="text-right font-medium px-3 py-2">Growth</th>
              </tr>
            </thead>
            <tbody>
              {report.summaries.map((s) => (
                <tr key={s.platform} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {PLATFORM_META[s.platform]?.label ?? s.platform}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.accountName}
                  </td>
                  <td className="px-3 py-2 text-right">{num(s.metrics.followers)}</td>
                  <td className="px-3 py-2 text-right">{num(s.metrics.views)}</td>
                  <td className="px-3 py-2 text-right">{num(s.metrics.content)}</td>
                  <td className="px-3 py-2 text-right">{num(s.metrics.likes)}</td>
                  <td className="px-3 py-2 text-right">{num(s.metrics.comments)}</td>
                  <td className="px-3 py-2 text-right">
                    {s.metrics.engagementRate === null
                      ? "N/A"
                      : `${s.metrics.engagementRate}%`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.growth.followersPct === null
                      ? "N/A"
                      : `${s.growth.followersPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Growth chart */}
      {report.series.length >= 2 && (
        <section className="glass-card rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">
            Audience Growth
          </h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.series} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="followers" name="Followers" stroke="var(--primary)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Top content */}
      <section className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Best Performing Content</h2>
        {report.platforms.map((platform) => {
          const top = report.topContent[platform];
          if (!top) return null;
          const items = [
            { label: "Most views", content: top.byViews },
            { label: "Most likes", content: top.byLikes },
            { label: "Most comments", content: top.byComments },
            { label: "Highest engagement", content: top.byEngagement },
          ].filter((i) => i.content);
          if (items.length === 0) return null;
          return (
            <div key={platform}>
              <p className="text-sm font-medium text-foreground mb-2">
                {PLATFORM_META[platform]?.label ?? platform}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((item) => (
                  <div
                    key={item.label}
                    className="flex gap-2 p-2 rounded-lg border border-border"
                  >
                    {item.content!.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.content!.thumbnailUrl}
                        alt=""
                        className="w-12 h-9 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-9 rounded bg-muted shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-foreground truncate">
                        {item.content!.url ? (
                          <a
                            href={item.content!.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary"
                          >
                            {item.content!.title || item.content!.caption || item.content!.id}
                          </a>
                        ) : (
                          item.content!.title || item.content!.caption || item.content!.id
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Unavailable metrics */}
      {report.unavailableNotes.length > 0 && (
        <section className="glass-card rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-2">
            Notes — Unavailable Metrics
          </h2>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {report.unavailableNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function num(value: number | null): string {
  return value === null ? "N/A" : formatCompact(value);
}
