"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Settings as SettingsIcon, CheckCircle2, XCircle } from "lucide-react";
import { Header } from "@/components/header";
import { ConnectedAccounts } from "@/components/settings/connected-accounts";
import { useConnectedAccounts } from "@/components/settings/use-connected-accounts";
import { PLATFORM_META } from "@/lib/platform-meta";
import type { OAuthPlatform } from "@/lib/oauth/types";

const REASON_MESSAGES: Record<string, string> = {
  not_configured: "OAuth is not configured for this platform yet.",
  denied: "Authorization was cancelled or denied.",
  invalid_state: "The sign-in request could not be verified (invalid state).",
  missing_code: "The provider did not return an authorization code.",
  no_accounts: "No connectable account was found for this login.",
  pending_failed: "Could not prepare account selection. Please try again.",
  provider_error: "The provider rejected the request. Please try again.",
  unsupported: "This platform is not supported.",
  unknown: "An unexpected error occurred.",
};

function ConnectResult() {
  const params = useSearchParams();
  const connected = params.get("connected") as OAuthPlatform | null;
  const errorPlatform = params.get("connect_error") as OAuthPlatform | null;
  const reason = params.get("reason");

  if (connected) {
    const label = PLATFORM_META[connected]?.label ?? connected;
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        {label} connected successfully.
      </div>
    );
  }

  if (errorPlatform) {
    const label = PLATFORM_META[errorPlatform]?.label ?? errorPlatform;
    const message = reason ? REASON_MESSAGES[reason] : undefined;
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
        <XCircle className="w-4 h-4" />
        Could not connect {label}. {message ?? "Please try again."}
      </div>
    );
  }

  return null;
}

export default function SettingsPage() {
  const { accounts, providers, encryption, loading, error, connect, disconnect } =
    useConnectedAccounts();

  return (
    <main className="min-h-screen">
      <Header />

      <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Connected Accounts
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect your social accounts through their official OAuth. Access
              tokens are stored server-side and never exposed to the browser.
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <ConnectResult />
        </Suspense>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="skeleton w-11 h-11 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <div className="skeleton w-32 h-4 rounded" />
                  <div className="skeleton w-48 h-3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ConnectedAccounts
            accounts={accounts}
            providers={providers}
            encryption={encryption}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        )}
      </div>
    </main>
  );
}
