/**
 * Shared RapidAPI request helper.
 *
 * Every RapidAPI-powered platform (Instagram, Facebook, Threads, TikTok) uses
 * the same auth headers, so the request/parse/error handling lives here.
 */

const RAPIDAPI_BASE_HEADERS = (key: string) => ({
  "x-rapidapi-key": key,
  "Content-Type": "application/json",
});

export interface RapidApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

export function getRapidApiKey(): string | undefined {
  return process.env.RAPIDAPI_KEY;
}

/**
 * Performs a GET against a RapidAPI host and returns a normalised result.
 * Never throws for HTTP/network errors — callers surface them as per-platform
 * error badges.
 */
export async function rapidGet<T = unknown>(
  host: string | undefined,
  path: string,
  params: Record<string, string | undefined> = {}
): Promise<RapidApiResult<T>> {
  const key = getRapidApiKey();
  if (!host) {
    return { ok: false, status: 0, data: null, error: "RapidAPI host not configured" };
  }
  if (!key) {
    return { ok: false, status: 0, data: null, error: "RAPIDAPI_KEY is not configured" };
  }

  const url = new URL(`https://${host}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, value);
    }
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        ...RAPIDAPI_BASE_HEADERS(key),
        "x-rapidapi-host": host,
      },
      cache: "no-store",
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON body (e.g. an HTML error page).
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Unexpected non-JSON response (${res.status})`,
      };
    }

    if (!res.ok) {
      const message =
        extractMessage(json) || `RapidAPI error (${res.status})`;
      return { ok: false, status: res.status, data: null, error: message };
    }

    return { ok: true, status: res.status, data: json as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/** Best-effort message extraction from the various vendor error shapes. */
function extractMessage(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const obj = json as Record<string, unknown>;
  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.msg === "string") return obj.msg;
  if (typeof obj.error === "string") return obj.error;
  const meta = obj.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta.message === "string") return meta.message;
  const error = obj.error as Record<string, unknown> | undefined;
  if (error && typeof error.message === "string") return error.message;
  return undefined;
}

/** Coerces a value (number or numeric string) into a finite number. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
