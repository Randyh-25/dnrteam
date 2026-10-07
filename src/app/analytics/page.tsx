import { TrendingUp } from "lucide-react";

export const metadata = { title: "Analytics — Gen Tyz" };

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen p-6">
      <div className="glass-card rounded-xl p-10 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          The combined growth timeline is available on the Overview dashboard.
          Deeper per-platform analytics will be added here.
        </p>
      </div>
    </main>
  );
}
