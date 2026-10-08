import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every navigation, redirects
 * unauthenticated visitors away from protected areas and sets a per-request
 * Content-Security-Policy (nonce-based). Authorization itself is enforced
 * server-side (layouts, actions) and in the database (RLS).
 */
const PROTECTED_PREFIXES = ["/espace", "/etablissement", "/admin", "/bienvenue", "/securite"];

const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = supabaseOrigin ? ` ${supabaseOrigin}` : "";
  const supabaseWs = supabaseOrigin ? ` ${supabaseOrigin.replace(/^http/, "ws")}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React style attributes (progress bars…) need inline styles; scripts stay strict.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase} https://image.mux.com`,
    "font-src 'self'",
    `media-src 'self' blob:${supabase} https://stream.mux.com https://*.mux.com`,
    `connect-src 'self'${supabase}${supabaseWs} https://*.mux.com`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  // Next.js reads the nonce from the request CSP header and applies it to its own scripts.
  const requestHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return headers;
  };
  const next = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders() } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Validates the JWT and refreshes it when needed. Do not remove.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?suite=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|pdf.worker.min.mjs|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
