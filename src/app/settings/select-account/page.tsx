"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";

interface Candidate {
  platformAccountId: string;
  accountName: string;
  username?: string;
  avatarUrl?: string;
  accountType?: string;
}

function SelectAccountInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pendingId = params.get("pending");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!pendingId) {
        setError("Missing selection reference.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/auth/pending/${pendingId}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          identities?: Candidate[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Request failed");
        if (!cancelled) setCandidates(json.identities ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load accounts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pendingId]);

  const select = async (platformAccountId: string) => {
    if (!pendingId) return;
    setSaving(platformAccountId);
    try {
      const res = await fetch(`/api/auth/pending/${pendingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformAccountId }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || "Failed to save selection");
      }
      router.push("/settings?connected=facebook");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save selection");
      setSaving(null);
    }
  };

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto glass-card rounded-xl p-6 space-y-4">
        <h1 className="text-lg font-semibold text-foreground">
          Select an account
        </h1>
        <p className="text-sm text-muted-foreground">
          Your login can access multiple accounts. Choose which one to connect.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <button
                key={c.platformAccountId}
                onClick={() => select(c.platformAccountId)}
                disabled={saving !== null}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left disabled:opacity-50"
              >
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">
                    {c.accountName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.accountType}
                    {c.username ? ` · @${c.username}` : ""}
                  </p>
                </div>
                {saving === c.platformAccountId && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SelectAccountPage() {
  return (
    <Suspense fallback={null}>
      <SelectAccountInner />
    </Suspense>
  );
}
