import "server-only";
import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { serverEnv } from "@/lib/server-env";
import { createClient } from "@/lib/supabase/server";
import type { VideoProvider } from "@/lib/types";

export const MEDIA_BUCKET = "course-media";

export type VideoSource =
  | { type: "mp4"; url: string }
  | { type: "hls"; url: string; poster?: string }
  | { type: "unavailable"; reason: "not_configured" | "missing" | "denied" };

/**
 * Creates a short-lived signed URL for a private object, AS THE CURRENT
 * USER: Supabase Storage applies the course-media RLS policy, so a learner
 * without access to the course cannot obtain a URL even for a known path.
 */
export async function signedMediaUrl(path: string, expiresInSeconds: number, download?: string | boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSeconds, download ? { download } : undefined);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Mux signed playback (adaptive HLS). Tokens expire; playback IDs must use the "signed" policy. */
async function muxSignedUrls(playbackId: string, ttlSeconds: number) {
  const mux = serverEnv.mux;
  if (!mux) return null;
  const key = createPrivateKey(Buffer.from(mux.privateKey, "base64").toString("utf8"));
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sign = (aud: "v" | "t") =>
    new SignJWT({ sub: playbackId, aud, exp })
      .setProtectedHeader({ alg: "RS256", kid: mux.keyId })
      .sign(key);
  const [videoToken, thumbToken] = await Promise.all([sign("v"), sign("t")]);
  return {
    url: `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8?token=${videoToken}`,
    poster: `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.webp?token=${thumbToken}`,
  };
}

export async function videoSource(lesson: {
  video_provider: VideoProvider | null;
  video_ref: string | null;
  video_duration_seconds: number | null;
}): Promise<VideoSource> {
  if (!lesson.video_provider || !lesson.video_ref) return { type: "unavailable", reason: "missing" };
  // Long enough to watch the whole video at normal speed, capped at 6 h.
  const ttl = Math.min(6 * 3600, Math.max(3600, (lesson.video_duration_seconds ?? 0) * 2));

  if (lesson.video_provider === "mux") {
    const signed = await muxSignedUrls(lesson.video_ref, ttl);
    return signed ? { type: "hls", url: signed.url, poster: signed.poster } : { type: "unavailable", reason: "not_configured" };
  }
  const url = await signedMediaUrl(lesson.video_ref, ttl);
  return url ? { type: "mp4", url } : { type: "unavailable", reason: "denied" };
}
