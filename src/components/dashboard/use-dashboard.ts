"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardResponse,
  HistoryResponse,
  PlatformStats,
} from "@/lib/types";

interface DashboardState {
  platforms: PlatformStats[];
  totals: DashboardResponse["totals"] | null;
  history: HistoryResponse["data"];
  lastUpdated: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  platforms: [],
  totals: null,
  history: [],
  lastUpdated: null,
  loading: true,
  refreshing: false,
  error: null,
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

/**
 * Loads all dashboard data. The first load spans both the aggregate stats and
 * the historical series; a refresh only re-requests stats with `force=1` so
 * the Firestore cache is invalidated server-side.
 */
export function useDashboard() {
  const [state, setState] = useState<DashboardState>(initialState);

  const load = useCallback(async (force: boolean) => {
    setState((prev) => ({
      ...prev,
      loading: prev.platforms.length === 0 && !force,
      refreshing: force,
      error: null,
    }));

    try {
      const dashboard = await getJson<DashboardResponse>(
        `/api/dashboard${force ? "?force=1" : ""}`
      );

      const history = force
        ? state.history
        : await getJson<HistoryResponse>("/api/history?days=30")
            .then((r) => r.data)
            .catch(() => []);

      setState((prev) => ({
        ...prev,
        platforms: dashboard.platforms,
        totals: dashboard.totals,
        history: history ?? prev.history,
        lastUpdated: dashboard.lastUpdated,
        loading: false,
        refreshing: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data",
      }));
    }
    // `state.history` is intentionally read but not a dependency: it is only
    // used to preserve the series on refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { ...state, refresh };
}
