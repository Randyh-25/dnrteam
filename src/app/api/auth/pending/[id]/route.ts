import { NextResponse, type NextRequest } from "next/server";
import { getDefaultOwnerId } from "@/lib/oauth/session";
import {
  deletePendingConnection,
  readPendingConnection,
} from "@/lib/oauth/pending";
import { upsertAccount } from "@/lib/oauth/store";
import type { OAuthPlatform } from "@/lib/oauth/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/pending/[id]
 *
 * Returns the (token-free) candidate account list for a pending connection so
 * the selection UI can render it. Ownership is enforced against the owner id.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/auth/pending/[id]">
) {
  const { id } = await ctx.params;
  const ownerId = getDefaultOwnerId();
  const pending = await readPendingConnection(id, ownerId);
  if (!pending) {
    return NextResponse.json(
      { error: "This connection request has expired. Please try again." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    platform: pending.platform,
    identities: pending.identities.map((identity) => ({
      platformAccountId: identity.platformAccountId,
      accountName: identity.accountName,
      username: identity.username,
      avatarUrl: identity.avatarUrl,
      accountType: identity.accountType,
    })),
  });
}

/**
 * POST /api/auth/pending/[id]
 *
 * Commits the selected identity: stores the connection with the token bundle
 * held in the pending record, then deletes the pending record.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/auth/pending/[id]">
) {
  const { id } = await ctx.params;
  const ownerId = getDefaultOwnerId();

  let platformAccountId: string | undefined;
  try {
    const body = (await request.json()) as { platformAccountId?: string };
    platformAccountId = body?.platformAccountId;
  } catch {
    platformAccountId = undefined;
  }
  if (!platformAccountId) {
    return NextResponse.json(
      { error: "platformAccountId is required" },
      { status: 400 }
    );
  }

  const pending = await readPendingConnection(id, ownerId);
  if (!pending) {
    return NextResponse.json(
      { error: "This connection request has expired. Please try again." },
      { status: 404 }
    );
  }

  const identity = pending.identities.find(
    (i) => i.platformAccountId === platformAccountId
  );
  if (!identity) {
    return NextResponse.json(
      { error: "Selected account is not part of this request" },
      { status: 400 }
    );
  }

  const account = await upsertAccount({
    ownerId,
    platform: pending.platform as OAuthPlatform,
    platformAccountId: identity.platformAccountId,
    accountName: identity.accountName,
    username: identity.username,
    avatarUrl: identity.avatarUrl,
    profileUrl: identity.profileUrl,
    accountType: identity.accountType,
    extra: identity.extra,
    tokens: pending.tokens,
  });

  await deletePendingConnection(id);

  return NextResponse.json({ ok: true, account });
}
