"use client";

import { useCallback, useEffect, useState } from "react";
import type { NormalizedPlatformDetail } from "@/lib/normalize/types";
import type { PlatformKey } from "@/lib/types";

export type DetailStatus = "ok" | "not_connected" | "reauth_required" | "error";

export interface PlatformDetailState {
  status: DetailStatus | "loading";
  data: NormalizedPlatformDetail | null;
  message: string | null;
  cached: boolean;
  loading: boolean;
  error: string | null;
}

async function fetchDetail(
  platform: PlatformKey,
  limit: number,
  force: boolean
): Promise<
  | { ok: true; data: NormalizedPlatformDetail; cached: boolean }
  | { ok: false; status: DetailStatus; message: string }
> {
  try {
    const res = await fetch(
      `/api/platform/${platform}?limit=${limit}${force ? "&force=1" : ""}`,
      { cache: "no-store" }
    );
    const json = (await res.json()) as {
      status: DetailStatus;
      data?: NormalizedPlatformDetail;
      message?: string;
      cached?: boolean;
    };
    if (json.status === "ok" && json.data) {
      return { ok: true, data: json.data, cached: json.cached ?? false };
    }
    return {
      ok: false,
      status: json.status ?? "error",
      message: json.message ?? "Unable to load platform data",
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Loads normalized detail for one platform. `limit` controls how much content
 * to fetch (drives "Load more"); `reload` forces a refresh.
 */
export function usePlatformDetail(platform: PlatformKey, initialLimit = 12) {
  const [limit, setLimit] = useState(initialLimit);
  const [state, setState] = useState<PlatformDetailState>({
    status: "loading",
    data: null,
    message: null,
    cached: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      const result = await fetchDetail(platform, limit, false);
      if (cancelled) return;
      if (result.ok) {
        setState({
          status: "ok",
          data: result.data,
          message: null,
          cached: result.cached,
          loading: false,
          error: null,
        });
      } else {
        setState({
          status: result.status,
          data: null,
          message: result.message,
          cached: false,
          loading: false,
          error: result.message,
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [platform, limit]);

  const loadMore = useCallback(() => setLimit((l) => Math.min(l + 12, 50)), []);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const result = await fetchDetail(platform, limit, true);
    if (result.ok) {
      setState({
        status: "ok",
        data: result.data,
        message: null,
        cached: false,
        loading: false,
        error: null,
      });
    } else {
      setState({
        status: result.status,
        data: null,
        message: result.message,
        cached: false,
        loading: false,
        error: result.message,
      });
    }
  }, [platform, limit]);

  return { ...state, limit, loadMore, reload };
}
