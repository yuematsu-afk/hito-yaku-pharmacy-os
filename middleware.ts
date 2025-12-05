// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Supabase のセッション(JWT)は cookie の "sb-access-token"
 * or "sb:token" (projectによる) に入っている想定
 * ※ 現状は Cookie が無くても、後方互換のため残しておく
 */
function getAccessToken(req: NextRequest): string | null {
  return (
    req.cookies.get("sb-access-token")?.value ??
    req.cookies.get("sb:token")?.value ??
    null
  );
}

/**
 * ユーザーの role を cookie に保存しておき、
 * middleware では cookie からのみ参照する方式にする
 *
 * これは「middleware では DB にアクセスできない」Next.js の制約に準拠した方式。
 */
function getUserRole(req: NextRequest): string | null {
  return req.cookies.get("hito_yaku_role")?.value ?? null;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // ロール（patient / pharmacy_company / admin / 旧 pharmacy / null）
  const role = getUserRole(req);

  // 🔴 ログイン判定：
  // - Supabase の access token がある
  // - もしくは role cookie が入っている
  // どちらかが true なら「ログイン済み」とみなす
  const isLoggedIn = !!getAccessToken(req) || !!role;

  // === 認証が不要なページ（login, register）はログイン済みならリダイレクト ===
  if (isLoggedIn && (path === "/login" || path === "/register")) {
    if (role === "pharmacy" || role === "pharmacy_company") {
      url.pathname = "/pharmacy/dashboard";
    } else if (role === "admin") {
      url.pathname = "/admin/dashboard";
    } else {
      url.pathname = "/mypage";
    }
    return NextResponse.redirect(url);
  }

  // === 認証必須ページ ===
  const requiresAuth =
    path.startsWith("/mypage") ||
    path.startsWith("/pharmacy") ||
    path.startsWith("/admin");

  if (requiresAuth && !isLoggedIn) {
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // === ロールガード (/pharmacy) ===
  if (path.startsWith("/pharmacy")) {
    if (
      role !== "pharmacy" &&
      role !== "pharmacy_company" &&
      role !== "admin"
    ) {
      url.pathname = "/mypage";
      return NextResponse.redirect(url);
    }
  }

  // === ロールガード (/admin) ===
  if (path.startsWith("/admin")) {
    if (role !== "admin") {
      url.pathname = "/mypage";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/mypage/:path*",
    "/pharmacy/:path*",
    "/admin/:path*",
  ],
};
