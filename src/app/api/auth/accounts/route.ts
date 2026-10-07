import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/oauth/store";
import { getProviderStatuses } from "@/lib/oauth/providers";
import { getDefaultOwnerId } from "@/lib/oauth/session";
import { isEncryptionAvailable } from "@/lib/oauth/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/accounts
 *
 * Returns the owner's connected accounts (token-free projection) plus the
 * per-platform provider availability, so the UI can render Connect vs.
 * Connected vs. "Not configured" without guessing.
 */
export async function GET() {
  const ownerId = getDefaultOwnerId();

  const [accounts, providers] = await Promise.all([
    listAccounts(ownerId),
    Promise.resolve(getProviderStatuses()),
  ]);

  return NextResponse.json(
    {
      accounts,
      providers,
      encryption: isEncryptionAvailable() ? "enabled" : "disabled",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
