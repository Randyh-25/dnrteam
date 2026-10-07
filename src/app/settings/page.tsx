import { Settings } from "lucide-react";

export const metadata = { title: "Settings — Gen Tyz" };

const envVars = [
  { key: "YOUTUBE_API_KEY", label: "YouTube Data API key" },
  { key: "META_ACCESS_TOKEN", label: "Meta long-lived access token" },
  { key: "RAPIDAPI_KEY", label: "RapidAPI TikTok key" },
  { key: "FIREBASE_PROJECT_ID", label: "Firebase project ID" },
];

export default function SettingsPage() {
  return (
    <main className="min-h-screen p-6">
      <div className="glass-card rounded-xl p-6 space-y-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Credentials are configured through environment variables.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border divide-y divide-border">
          {envVars.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {item.key}
              </code>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Set these in <code>.env</code> locally or in your Vercel project
          settings. Values are only read server-side and are never exposed to
          the browser.
        </p>
      </div>
    </main>
  );
}
