"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ConnectedAccountPublic,
  OAuthPlatform,
  ProviderStatus,
} from "@/lib/oauth/types";

interface AccountsResponse {
  accounts: ConnectedAccountPublic[];
  providers: ProviderStatus[];
  encryption: "enabled" | "disabled";
}

interface AccountsState extends AccountsResponse {
  loading: boolean;
  error: string | null;
}

const initialState: AccountsState = {
  accounts: [],
  providers: [],
  encryption: "disabled",
  loading: true,
  error: null,
};

/**
 * Loads the owner's connected accounts and per-provider availability, and
 * exposes connect / disconnect actions.
 */
export function useConnectedAccounts() {
  const [state, setState] = useState<AccountsState>(initialState);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/accounts", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = (await res.json()) as AccountsResponse;
      setState({ ...json, loading: false, error: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to load accounts",
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/auth/accounts", { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as AccountsResponse;
        if (!cancelled) setState({ ...json, loading: false, error: null });
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load accounts",
          }));
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Begins the OAuth flow. This is an intentional full-page navigation to our
   * own server route (which then 302s to the external provider), not an SPA
   * route change — so `window.location.assign` is required here.
   */
  const connect = useCallback((platform: OAuthPlatform) => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/${platform}/connect`);
  }, []);

  const disconnect = useCallback(
    async (platform: OAuthPlatform) => {
      try {
        const stateRes = await fetch(`/api/auth/${platform}/disconnect`, {
          cache: "no-store",
        });
        const { state } = (await stateRes.json()) as { state?: string };
        const res = await fetch(`/api/auth/${platform}/disconnect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        await load();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Failed to disconnect",
        }));
      }
    },
    [load]
  );

  return { ...state, reload: load, connect, disconnect };
}
