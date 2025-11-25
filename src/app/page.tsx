// src/app/page.tsx
"use client";
import Link from "next/link";
import { AppButton } from "@/components/ui/app-button";


export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        顧問薬剤師診断（MVP）
      </h1>
      <p className="text-slate-700">
        症状・生活スタイル・価値観から、あなたに合った
        「顧問薬剤師タイプ」と候補の薬剤師を提案します。
      </p>
      <div>
        <Link
          href="/diagnosis"
          className="inline-flex items-center rounded-md border border-transparent bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
        >
          診断をはじめる
        </Link>
      </div>
      <div className="mt-4 flex justify-center">
        <AppButton
          variant="outline"
          size="md"
          onClick={() => (window.location.href = "/pharmacists")}
        >
          薬剤師一覧を見る
        </AppButton>
      </div>

      <p className="text-xs text-slate-500">
        ※ 現在はMVP版です。機能やデザインは今後アップデートされます。
      </p>
    </div>
    
  );
}
