import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // login / register / reset-password は素通し
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password")
  ) {
    return NextResponse.next();
  }

  // admin 保護
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("admin_token")?.value;
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin-login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // pharmacy 保護
  if (pathname.startsWith("/pharmacy")) {
    // Supabase セッション cookie が無ければ未ログイン
    const hasSession =
      req.cookies.get("sb-access-token") ||
      req.cookies.get("sb-refresh-token");

    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?redirectTo=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/pharmacy/:path*"],
};
