// middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Supabase のセッション判定（Edge middleware では DB を見ない）
 * ※ Supabase JS は基本 localStorage を使うが、OAuth/SSR構成や設定次第で cookie も使う。
 * ここでは「cookie にセッションがある場合のみログイン済み」とみなす。
 *
 * 重要：
 * - role cookie は “ログイン判定” に使わない（古いcookieで偽陽性→ループ/停止の原因）
 */
function hasSupabaseSessionCookie(req: NextRequest): boolean {
  // supabase cookie 名は環境やライブラリで揺れるので “前方一致” も見る
  const all = req.cookies.getAll().map((c) => c.name);

  // よくある候補
  if (req.cookies.get("sb-access-token")?.value) return true;
  if (req.cookies.get("sb-refresh-token")?.value) return true;

  // 旧/別形式（念のため）
  if (req.cookies.get("sb:token")?.value) return true;

  // @supabase/ssr が使う形式（project ref が入る）
  // 例: sb-<project-ref>-auth-token
  if (all.some((n) => n.startsWith("sb-") && n.includes("-auth-token"))) return true;

  return false;
}

/** ロールは補助情報としてのみ扱う */
function getUserRole(req: NextRequest): string | null {
  return req.cookies.get("hito_yaku_role")?.value ?? null;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;
  const search = url.search ?? "";

  // ① public は常に素通し（未ログインでも login を見せる）
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ② admin のみ：従来の admin_token 方式を維持
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("admin_token")?.value;
    if (!token) {
      const to = new URL("/admin-login", req.url);
      to.searchParams.set("redirectTo", pathname + search);
      return NextResponse.redirect(to);
    }
    return NextResponse.next();
  }

  // ③ 認証が必要なページ（/mypage, /pharmacy）
  const requiresAuth = pathname.startsWith("/mypage") || pathname.startsWith("/pharmacy");

  if (requiresAuth) {
    const loggedIn = hasSupabaseSessionCookie(req);

    // 未ログインなら /login へ。redirectTo は search も含めて保持
    if (!loggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ④ ロールガード（ログイン済み前提でのみ意味がある）
  if (pathname.startsWith("/pharmacy")) {
    const role = getUserRole(req);
    if (role !== "pharmacy_company" && role !== "admin" && role !== "pharmacy") {
      const to = new URL("/mypage", req.url);
      return NextResponse.redirect(to);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register", "/reset-password", "/mypage/:path*", "/pharmacy/:path*", "/admin/:path*"],
};
