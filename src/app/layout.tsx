// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./providers";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "PharmacyOS | ヒトヤク",
  description:
    "患者と薬剤師・薬局をつなぐオンライン相談・顧問薬剤師プラットフォーム",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {/* App 全体の Provider（Supabase / UserContext など） */}
        <AppProviders>
          {/* 共通ヘッダー（クライアント側でログイン状態に追従） */}
          <SiteHeader />

          {/* メインコンテンツ */}
          <main className="mx-auto max-w-6xl px-4 py-6">
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
