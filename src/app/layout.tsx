// src/app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmacyOS | ヒトヤク",
  description: "患者と薬剤師・薬局をつなぐオンライン相談・顧問薬剤師プラットフォーム",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {/* 共通ヘッダー：どのページからでもトップに戻れる導線 */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            {/* PharmacyOS ロゴ兼トップページリンク */}
            <Link
              href="/"
              className="flex items-center gap-2"
            >
              <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-700">
                ヒトヤク
              </span>
              <span className="hidden text-sm text-slate-600 sm:inline">
                あなたに合う薬剤師が見つかるプラットフォーム
              </span>
            </Link>

            {/* 右側：簡易ナビ（必要に応じて拡張可） */}
            <nav className="flex items-center gap-3 text-xs sm:text-sm">
              <Link
                href="/diagnosis"
                className="text-slate-600 hover:text-emerald-700"
              >
                診断をはじめる
              </Link>
              <Link
                href="/pharmacists"
                className="text-slate-600 hover:text-emerald-700"
              >
                薬剤師を探す
              </Link>
              <Link
                href="/admin"
                className="text-slate-400 hover:text-slate-700"
              >
                管理画面
              </Link>
            </nav>
          </div>
        </header>

        {/* コンテンツ領域 */}
        <main className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
