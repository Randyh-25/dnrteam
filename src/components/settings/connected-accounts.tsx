"use client";

import {
  CheckCircle2,
  AlertTriangle,
  Link2,
  RefreshCw,
  Unplug,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { PLATFORM_META } from "@/lib/platform-meta";
import { formatDateTime } from "@/lib/format";
import type {
  ConnectedAccountPublic,
  OAuthPlatform,
  ProviderStatus,
} from "@/lib/oauth/types";

interface ConnectedAccountsProps {
  accounts: ConnectedAccountPublic[];
  providers: ProviderStatus[];
  encryption: "enabled" | "disabled";
  onConnect: (platform: OAuthPlatform) => void;
  onDisconnect: (platform: OAuthPlatform) => void;
}

const PLATFORMS: OAuthPlatform[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

/**
 * Connected Accounts manager. Never renders token values — only account
 * identity, status, and provider availability.
 */
export function ConnectedAccounts({
  accounts,
  providers,
  encryption,
  onConnect,
  onDisconnect,
}: ConnectedAccountsProps) {
  const accountByPlatform = new Map(accounts.map((a) => [a.platform, a]));
  const providerByPlatform = new Map(providers.map((p) => [p.platform, p]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        {encryption === "enabled" ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            Tokens encrypted at rest
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-500">
            <ShieldAlert className="w-3.5 h-3.5" />
            Token encryption unavailable — set TOKEN_ENCRYPTION_KEY
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {PLATFORMS.map((platform) => {
          const meta = PLATFORM_META[platform];
          const account = accountByPlatform.get(platform);
          const provider = providerByPlatform.get(platform);
          const configured = provider?.availability === "ready";
          if (!meta) return null;

          return (
            <div
              key={platform}
              className="glass-card rounded-xl p-4 flex items-center justify-between gap-4"
              id={`connection-${platform}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${meta.color}15` }}
                >
                  <meta.icon className="w-6 h-6" style={{ color: meta.color }} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {meta.label}
                  </p>
                  {account ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground truncate">
                        {account.accountName}
                        {account.username ? ` · @${account.username}` : ""}
                      </span>
                      {account.status === "connected" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                          <AlertTriangle className="w-3 h-3" />
                          {account.status === "expired"
                            ? "Reauthentication required"
                            : account.status}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {configured
                        ? "Not connected"
                        : provider?.note ?? "OAuth not configured"}
                    </p>
                  )}
                  {account?.lastSyncedAt && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Last synced: {formatDateTime(account.lastSyncedAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {account ? (
                  <>
                    <a
                      href={`/platforms/${platform}`}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      View
                    </a>
                    <button
                      onClick={() => onConnect(platform)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                    </button>
                    <button
                      onClick={() => onDisconnect(platform)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Unplug className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onConnect(platform)}
                    disabled={!configured}
                    title={configured ? undefined : provider?.note}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
