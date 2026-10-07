import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";

/** 256-bit URL-safe token; only its SHA-256 hash is stored in the database. */
export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Unambiguous alphabet (no I, O, 0, 1) → e.g. « K7QM-2HXP-RW9D ». */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createEnrollmentCode() {
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(""),
  );
  return groups.join("-");
}

/** Normalizes user input like "k7qm 2hxp-rw9d" → "K7QM-2HXP-RW9D". */
export function normalizeEnrollmentCode(input: string) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 12) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
