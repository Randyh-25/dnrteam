"use client";

import { useCallback, useEffect, useState } from "react";
import type { StatsComparisonResponse } from "@/lib/types";

interface StatsState {
  data: StatsComparisonResponse | null;
  loading: boolean;
  error: string | null;
}

async function loadStats(
  force: boolean
): Promise<StatsComparisonResponse | { error: string }> {
  try {
    const res = await fetch(`/api/stats${force ? "?force=1" : ""}`, {
      cache: "no-store",
    });
    if (!res.ok) return { error: `Request failed (${res.status})` };
    return (await res.json()) as StatsComparisonResponse;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load stats",
    };
  }
}

/**
 * Loads the day-over-day stats comparison (`/api/stats`). Used by the
 * Platforms page to show current counts plus growth vs. yesterday.
 */
export function useStats() {
  const [state, setState] = useState<StatsState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = await loadStats(false);
      if (cancelled) return;
      if ("error" in result) {
        setState({ data: null, loading: false, error: result.error });
      } else {
        setState({ data: result, loading: false, error: null });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const result = await loadStats(true);
    if ("error" in result) {
      setState({ data: null, loading: false, error: result.error });
    } else {
      setState({ data: result, loading: false, error: null });
    }
  }, []);

  return { ...state, refresh };
}
