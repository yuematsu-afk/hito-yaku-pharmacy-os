// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function safeRedirectTo(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // 同一オリジンのパスのみを使う（open redirect防止）
  return pathname + (search ?? "");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ 認証不要ページは必ず素通し（自己ループ防止）
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/admin-login")
  ) {
    return NextResponse.next();
  }

  // ✅ role cookie（このプロジェクトの信頼ソース）
  const role = req.cookies.get("hito_yaku_role")?.value ?? null;

  // === /pharmacy ガード ===
  if (pathname.startsWith("/pharmacy")) {
    if (role !== "pharmacy_company" && role !== "admin") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", safeRedirectTo(req));
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // === /admin ガード ===
  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/admin-login", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/pharmacy/:path*", "/admin/:path*"],
};
