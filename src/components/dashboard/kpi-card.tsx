import { TrendingUp, TrendingDown, Users, Eye, Heart, BarChart3 } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel: string;
  icon: "users" | "eye" | "heart" | "chart";
  delay?: number;
}

const iconMap = {
  users: Users,
  eye: Eye,
  heart: Heart,
  chart: BarChart3,
};

export function KPICard({ title, value, change, changeLabel, icon, delay = 0 }: KPICardProps) {
  const Icon = iconMap[icon];
  const hasChange = typeof change === "number";
  const isPositive = (change ?? 0) >= 0;

  return (
    <div
      className={`glass-card rounded-xl p-5 opacity-0 animate-fade-in stagger-${delay}`}
      id={`kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1 animate-counter-up">{value}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        {hasChange ? (
          <>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
              {isPositive ? "+" : ""}{change}%
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{changeLabel}</span>
        )}
        {hasChange && (
          <span className="text-xs text-muted-foreground">{changeLabel}</span>
        )}
      </div>
    </div>
  );
}
