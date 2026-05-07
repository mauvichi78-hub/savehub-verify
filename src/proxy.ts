import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Routes that must stay reachable without auth so the PWA install / share
// pipeline works (manifest discovery, service worker registration, icons),
// plus messaging-platform webhooks called by Meta/Telegram (no user cookie).
const PUBLIC_PATHS = new Set([
  "/manifest.webmanifest",
  "/sw.js",
  "/robots.txt",
  "/sitemap.xml",
  "/api/telegram/webhook",
  "/api/whatsapp/webhook",
  // Public legal pages — must be reachable for Meta Business Verification.
  "/privacy",
  "/terms",
]);

const PUBLIC_PREFIXES = ["/icon-", "/apple-touch-icon"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

// Gates the entire app behind authentication. Anonymous visitors are
// redirected to /login. Once logged in, /login itself bounces back to /.
// /share is gated too — but the auth round-trip preserves the share
// payload via callbackUrl so nothing gets lost.
export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isOnLogin = nextUrl.pathname.startsWith("/login");

  if (isPublicPath(nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (isOnLogin) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const callbackUrl = nextUrl.pathname + nextUrl.search;
    const url = new URL("/login", nextUrl);
    if (callbackUrl !== "/") url.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Run on every page except framework static assets and the auth API.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
