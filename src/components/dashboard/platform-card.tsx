import { TrendingUp, TrendingDown } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";

/** Works for both Lucide icons and the inline brand SVGs. */
export type IconComponent = ComponentType<{
  className?: string;
  style?: CSSProperties;
}>;

export interface PlatformCardProps {
  platform: string;
  icon: IconComponent;
  color: string;
  followers: string;
  change: number;
  changeLabel: string;
  status: "online" | "error" | "loading";
  /** Optional error message shown when `status === "error"`. */
  error?: string;
  delay?: number;
}

export function PlatformCard({
  platform,
  icon: Icon,
  color,
  followers,
  change,
  changeLabel,
  status,
  error,
  delay = 0,
}: PlatformCardProps) {
  const isPositive = change >= 0;

  return (
    <div
      className={`glass-card rounded-xl p-5 opacity-0 animate-fade-in stagger-${delay}`}
      id={`platform-${platform.toLowerCase()}`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <span className="font-semibold text-foreground">{platform}</span>
        </div>
        <span
          className={`
            px-2.5 py-1 rounded-full text-xs font-medium
            ${status === "online" ? "badge-online" : status === "error" ? "badge-error" : "badge-loading"}
          `}
        >
          {status === "online" ? "● Live" : status === "error" ? "● Error" : "● Loading"}
        </span>
      </div>

      {/* Follower Count */}
      <p className="text-3xl font-bold text-foreground animate-counter-up">{followers}</p>
      <p className="text-sm text-muted-foreground mt-0.5">Followers</p>

      {/* Trend */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
        {status === "error" ? (
          <span className="text-xs text-muted-foreground line-clamp-2" title={error}>
            {error || "Unable to load data"}
          </span>
        ) : (
          <>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
              {isPositive ? "+" : ""}{change}%
            </span>
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* Skeleton version for loading state */
export function PlatformCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-lg" />
          <div className="skeleton w-24 h-5 rounded" />
        </div>
        <div className="skeleton w-16 h-6 rounded-full" />
      </div>
      <div className="skeleton w-32 h-9 rounded mb-1.5" />
      <div className="skeleton w-16 h-4 rounded" />
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-1.5">
        <div className="skeleton w-4 h-4 rounded" />
        <div className="skeleton w-12 h-4 rounded" />
        <div className="skeleton w-16 h-3 rounded" />
      </div>
    </div>
  );
}
