"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalyticsResponse, PlatformAnalytics } from "@/lib/types";

interface AnalyticsState {
  data: PlatformAnalytics[];
  loading: boolean;
  error: string | null;
}

const initialState: AnalyticsState = {
  data: [],
  loading: true,
  error: null,
};

async function loadAnalytics(days: number): Promise<PlatformAnalytics[] | { error: string }> {
  try {
    const res = await fetch(`/api/analytics?days=${days}`, {
      cache: "no-store",
    });
    if (!res.ok) return { error: `Request failed (${res.status})` };
    const json = (await res.json()) as AnalyticsResponse;
    return json.data;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to load analytics",
    };
  }
}

/**
 * Loads per-platform analytics for the given window. A `days` change triggers
 * a refetch (existing data stays visible); `reload` shows the loading state
 * and is intended to be called from event handlers.
 */
export function usePlatformAnalytics(days = 30) {
  const [state, setState] = useState<AnalyticsState>(initialState);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = await loadAnalytics(days);
      if (cancelled) return;
      if (Array.isArray(result)) {
        setState({ data: result, loading: false, error: null });
      } else {
        setState({ data: [], loading: false, error: result.error });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const result = await loadAnalytics(days);
    if (Array.isArray(result)) {
      setState({ data: result, loading: false, error: null });
    } else {
      setState({ data: [], loading: false, error: result.error });
    }
  }, [days]);

  return { ...state, reload };
}
