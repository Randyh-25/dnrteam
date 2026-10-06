import { Globe } from "lucide-react";

export const metadata = { title: "Platforms — DNR Team" };

export default function PlatformsPage() {
  return (
    <main className="min-h-screen p-6">
      <div className="glass-card rounded-xl p-10 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Platforms</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Detailed per-platform breakdowns are coming soon. Live follower counts
          and growth trends are already available on the Overview dashboard.
        </p>
      </div>
    </main>
  );
}
