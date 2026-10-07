import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";
import type { InvitationKind } from "@/lib/types";
import { clientIp, rateLimit } from "@/server/rate-limit";

export interface InvitationDescription {
  id: string;
  kind: InvitationKind;
  email: string;
  institution_id: string | null;
  institution_name: string | null;
  expires_at: string;
  state: "valid" | "expired" | "revoked" | "accepted";
  account_exists: boolean;
}

/** Server-only lookup used by the invitation page (rate-limited per IP). */
export async function describeInvitation(token: string): Promise<InvitationDescription | null | "rate_limited"> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  if (!(await rateLimit(`invite-view:${await clientIp()}`, 60, 15 * 60))) return "rate_limited";
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("describe_invitation", { p_token_hash: hashToken(token) });
  if (error) throw error;
  return (data as InvitationDescription | null) ?? null;
}
