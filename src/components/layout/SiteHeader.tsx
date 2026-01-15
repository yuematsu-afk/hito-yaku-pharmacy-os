// src/components/layout/SiteHeader.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { Menu, X } from "lucide-react";

export function SiteHeader() {
  const router = useRouter();
  const {
    loading,
    isAuthenticated,
    role,
    user,
    isPatient,
    isPharmacyCompany,
    isAdmin,
  } = useUser();

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();

      // role 用 Cookie も削除
      document.cookie = "hito_yaku_role=; path=/; max-age=0; SameSite=Lax";

      setMobileOpen(false);
      router.push("/");
    } catch (e) {
      console.error("[header] logout error", e);
    }
  };

  const isPharmacyLike = isPharmacyCompany || isAdmin;

  // 表示名（profiles を使わず、auth の metadata と email で表示）
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "";

  const pharmacyDisplayName =
    (displayName && displayName.trim().length > 0 ? displayName : null) ??
    (isAdmin ? "管理者アカウント" : "薬局アカウント");

  // メインメニュー（患者側 / 薬局側）
  const patientLinks = [
    { href: "/diagnosis", label: "診断をはじめる" },
    { href: "/pharmacists", label: "薬剤師を探す" },
    { href: "/favorites", label: "気になる一覧" },
  ];

  const pharmacyLinks = [
    { href: "/pharmacy/dashboard", label: "薬局ダッシュボード" },
    { href: "/pharmacy/stores", label: "店舗一覧" },
    { href: "/pharmacy/pharmacists", label: "薬剤師一覧" },
    { href: "/pharmacy/bookings", label: "予約・患者一覧" },
  ];

  const mainLinks = isPharmacyLike ? pharmacyLinks : patientLinks;

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-sm">
      {/* 上段：ロゴ + 右側（PCナビ / スマホボタン） */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:py-3">
        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-2" onClick={closeMobile}>
          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-700">
            ヒトヤク
          </span>
          <span className="hidden text-xs text-slate-600 sm:inline sm:text-sm">
            あなたに合う薬剤師が見つかるプラットフォーム
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* PC向けナビゲーション */}
          <nav className="hidden items-center gap-4 text-sm text-slate-600 md:flex">
            {mainLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-emerald-700"
              >
                {item.label}
              </Link>
            ))}

            {/* 右端：ログイン / ログアウト（PC） */}
            {loading ? (
              <Link
                href="/login"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                ログイン
              </Link>
            ) : isAuthenticated ? (
              <>
                {isPatient && (
                  <Link
                    href="/mypage"
                    className="font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    マイページ
                  </Link>
                )}

                {isPharmacyCompany && (
                  <Link
                    href="/pharmacy/dashboard"
                    className="font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    {pharmacyDisplayName}
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    href="/admin"
                    className="font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    {pharmacyDisplayName}
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-slate-600 hover:text-emerald-700"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                ログイン
              </Link>
            )}
          </nav>

          {/* スマホ用メニューボタン（md未満で表示） */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="メニューを開く"
          >
            {mobileOpen ? (
              <>
                <X className="mr-1 h-4 w-4" />
                閉じる
              </>
            ) : (
              <>
                <Menu className="mr-1 h-4 w-4" />
                メニュー
              </>
            )}
          </button>
        </div>
      </div>

      {/* スマホ用ドロワーメニュー（md未満） */}
      {mobileOpen && (
        <div className="border-t bg-white md:hidden">
          <nav className="mx-auto max-w-6xl px-4 py-3 space-y-3 text-sm">
            {/* メインメニュー */}
            <div className="space-y-1">
              {mainLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                  onClick={closeMobile}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* 区切り線 */}
            <div className="border-t border-slate-200 pt-3 mt-2" />

            {/* ログイン / ログアウト周り（スマホ用） */}
            <div className="space-y-1">
              {loading ? (
                <Link
                  href="/login"
                  className="block rounded-md px-2 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={closeMobile}
                >
                  ログイン
                </Link>
              ) : isAuthenticated ? (
                <>
                  {isPatient && (
                    <Link
                      href="/mypage"
                      className="block rounded-md px-2 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={closeMobile}
                    >
                      マイページ
                    </Link>
                  )}

                  {isPharmacyCompany && (
                    <Link
                      href="/pharmacy/dashboard"
                      className="block rounded-md px-2 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={closeMobile}
                    >
                      {pharmacyDisplayName}
                    </Link>
                  )}

                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block rounded-md px-2 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={closeMobile}
                    >
                      {pharmacyDisplayName}
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-slate-600 hover:bg-slate-50 hover:text-emerald-700"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="block rounded-md px-2 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={closeMobile}
                >
                  ログイン
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
