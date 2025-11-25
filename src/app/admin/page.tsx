// src/app/admin/page.tsx
"use client";

import Link from "next/link";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          管理画面（MVP）
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          患者データ、薬剤師、薬局情報を統合管理できます。
          下記の管理カードから各ページに移動できます。
        </p>
      </div>

      {/* 🔗 ナビゲーションカード群 */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">

        {/* ダッシュボード */}
        <AppCard className="flex flex-col justify-between p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              ダッシュボード
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              全体KPI・相談ログ統計
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              顧問患者数、対応状況、フォロー予定、相談ログ数、薬剤師ランキングなどを確認できます。
            </p>
          </div>
          <div className="mt-4">
            <Link href="/admin/dashboard">
              <AppButton size="sm" variant="primary" className="w-full justify-center">
                ダッシュボードへ
              </AppButton>
            </Link>
          </div>
        </AppCard>

        {/* 患者管理 */}
        <AppCard className="flex flex-col justify-between p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-500">
              患者管理
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              患者一覧（PRM）
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              顧問候補〜顧問中の患者のPRMデータを管理します。
            </p>
          </div>
          <div className="mt-4">
            <Link href="/admin/prm/patients">
              <AppButton size="sm" variant="primary" className="w-full justify-center">
                患者一覧を開く
              </AppButton>
            </Link>
          </div>
        </AppCard>

        {/* 薬剤師管理（登録＋ケアロール） */}
        <AppCard className="flex flex-col justify-between p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
              薬剤師管理
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              薬剤師登録・ケアロール設定
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              薬局スタッフが薬剤師プロフィールを登録し、性別・年代・相談スタイル（care_role）を設定できます。
            </p>
          </div>
          <div className="mt-4">
            <Link href="/admin/pharmacists">
              <AppButton size="sm" variant="primary" className="w-full justify-center">
                薬剤師管理ページを開く
              </AppButton>
            </Link>
          </div>
        </AppCard>

        {/* 薬局管理 */}
        <AppCard className="flex flex-col justify-between p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-500">
              薬局管理
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              薬局プロフィール一覧
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              薬局名・エリア・サービス内容・連絡先などを管理します。
            </p>
          </div>
          <div className="mt-4">
            <Link href="/admin/pharmacies">
              <AppButton size="sm" variant="primary" className="w-full justify-center">
                薬局一覧を開く
              </AppButton>
            </Link>
          </div>
        </AppCard>

        {/* 予約ログ */}
        <AppCard className="flex flex-col justify-between p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-pink-500">
              予約ログ
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">
              予約／問い合わせ一覧
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Googleカレンダー連携の予約ログや、お問い合わせ履歴を確認します。
            </p>
          </div>
          <div className="mt-4">
            <Link href="/admin/appointments">
              <AppButton size="sm" variant="primary" className="w-full justify-center">
                予約ログを見る
              </AppButton>
            </Link>
          </div>
        </AppCard>
      </div>
    </div>
  );
}
