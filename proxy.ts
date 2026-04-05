import { type NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./app/(auth)/auth.config";
import { guestRegex } from "./lib/constants";

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (
    pathname.includes("/api/auth") ||
    pathname.includes("/api/webhooks") ||
    pathname.includes("/api/zalo") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register")
  ) {
    return NextResponse.next();
  }

  const session = await auth();
  const token = session?.user;

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (!token) {
    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);

    return NextResponse.redirect(
      new URL(`${base}/api/auth/guest?redirectUrl=${redirectUrl}`, request.url),
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
