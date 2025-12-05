// src/app/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  Shield,
  Users,
  LayoutDashboard,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-16">
        {/* ヒーローセクション：法人向けメッセージ */}
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-100">
              <CheckCircle2 className="h-3 w-3" />
              <span>福利厚生 × オンライン薬剤師サービス</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                社員とその家族の
                <br className="hidden sm:block" />
                「かかりつけ薬剤師」を、オンラインで。
              </h1>
              <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                ヒトヤクは、企業の福利厚生として、
                社員とご家族が専門薬剤師にいつでも相談できるオンラインサービスです。
                <br />
                診断 → 結果 → 薬剤師プロフィールの3ステップで、
                自分に合う薬剤師と出会うことができます。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <AppButton onClick={() => router.push("/contact")}>
                企業向けに問い合わせる
                <ArrowRight className="ml-2 h-4 w-4" />
              </AppButton>
              <AppButton
                onClick={() => router.push("/diagnosis")}
                variant="outline"
                className="bg-white"
              >
                診断デモを試してみる
              </AppButton>
            </div>

            <p className="text-[11px] text-slate-500">
              ※ 社員ご本人だけでなく、ご家族（配偶者・お子さまなど）もご利用いただけます。
            </p>
          </div>

          {/* 右側：サービス全体イメージ画像（社員＆家族） */}
          <div className="relative mx-auto w-full max-w-md">
            <AppCard className="overflow-hidden border-emerald-50 bg-emerald-50/40">
              <div className="relative aspect-[4/3] w-full">
                {/* ▼ ここを実際の画像パスに差し替えてください */}
                <Image
                  src="/images/top/employee-family-square.jpg"
                  alt="社員と家族がオンラインで薬剤師に相談しているイメージ"
                  fill
                  className="object-cover"
                />
              </div>
            </AppCard>
            <div className="pointer-events-none absolute -bottom-4 -left-3 hidden rounded-xl bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-md sm:flex items-center gap-1">
              <Users className="h-3 w-3 text-emerald-500" />
              社員 & 家族向けオンライン薬剤師サービス
            </div>
          </div>
        </section>

        {/* 社員が実際に利用する3ステップ */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                社員が実際に利用する 3 ステップ
              </h2>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                診断 → 結果 → 薬剤師プロフィールまで、
                スマホ1つで完結するシンプルな体験です。
              </p>
            </div>
          </div>

          <AppCard className="space-y-6">
            {/* 3ステップのイメージ画像 */}
            <div className="relative mx-auto w-full max-w-3xl">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100">
                {/* ▼ ここを「診断→結果→薬剤師プロフィール」の画像パスに差し替え */}
                <Image
                  src="/images/top/employee-flow-ja.jpg"
                  alt="診断 → 結果 → 薬剤師プロフィールの3ステップ UI イメージ"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* テキスト＋実画面リンク */}
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              {/* STEP 1 */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wide text-emerald-700">
                  STEP 1
                </p>
                <h3 className="text-sm font-semibold text-slate-900">
                  診断（相談内容の入力）
                </h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  体調や相談したい内容を選んで、数分で簡単に入力します。
                  症状・生活状況・希望する相談スタイルなどをもとに、
                  最適な薬剤師候補を選びます。
                </p>
                <AppButton
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => router.push("/diagnosis")}
                >
                  診断画面を開く
                </AppButton>
              </div>

              {/* STEP 2 */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wide text-emerald-700">
                  STEP 2
                </p>
                <h3 className="text-sm font-semibold text-slate-900">
                  結果（薬剤師候補の表示）
                </h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  診断結果にあわせて、相性の良さそうな薬剤師が
                  3名ほど候補として表示されます。対応言語・得意分野・
                  相談スタイルなどから比較できます。
                </p>
                <AppButton
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => router.push("/diagnosis")}
                >
                  結果イメージを見る（診断から遷移）
                </AppButton>
              </div>

              {/* STEP 3 */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wide text-emerald-700">
                  STEP 3
                </p>
                <h3 className="text-sm font-semibold text-slate-900">
                  薬剤師プロフィール & 相談
                </h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  プロフィールでは、人柄・得意領域・相談スタイル・
                  予約方法などを確認できます。社員やご家族は、
                  一番安心して相談できそうな薬剤師を1人選びます。
                </p>
                <AppButton
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => router.push("/pharmacists")}
                >
                  薬剤師プロフィールの例を見る
                </AppButton>
              </div>
            </div>
          </AppCard>
        </section>

        {/* 企業が導入するメリット */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              企業が ヒトヤク を導入する 3つのメリット
            </h2>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              社員とそのご家族の健康不安を軽くし、
              健康経営・福利厚生の質を高めるためのプラットフォームです。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <AppCard className="space-y-2 border-emerald-50 bg-white">
              <HeartHandshake className="h-6 w-6 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                家族をふくめた健康不安を軽くする
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                病院に行く前の「ちょっと聞きたい」を、
                専門薬剤師に気軽に相談できます。
                ご家族の薬・副作用・飲み合わせなども含めてサポートします。
              </p>
            </AppCard>

            <AppCard className="space-y-2 border-emerald-50 bg白">
              <Shield className="h-6 w-6 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                正確な医療情報を専門家から直接
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                インターネットの断片的な情報ではなく、
                薬剤師が社員の状況にあわせて説明することで、
                不安と情報のミスマッチを減らします。
              </p>
            </AppCard>

            <AppCard className="space-y-2 border-emerald-50 bg-white">
              <Users className="h-6 w-6 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                健康経営・採用ブランディングにも
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                「家族までカバーするヘルスケア福利厚生」として、
                採用広報やエンゲージメント向上の打ち出しにも利用できます。
              </p>
            </AppCard>
          </div>
        </section>

        {/* 薬局法人向けの紹介（B2Bもう一軸） */}
        <section>
          <AppCard className="grid gap-4 border-sky-50 bg-sky-50/40 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-center">
            <div className="space-y-3 text-sm">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                薬局法人さま向け：オンライン相談の新しいチャネルとして
              </h2>
              <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                ヒトヤク は、薬局法人さま向けの
                オンライン相談チャネルとしてもご利用いただけます。
                得意分野や対応言語を活かして、薬剤師の活躍の場を広げられます。
              </p>
              <ul className="space-y-1 text-xs text-slate-700">
                <li>・オンライン相談の新しい窓口を持てる</li>
                <li>・得意領域／言語を活かした薬剤師の活躍機会を創出</li>
                <li>・患者さんとの継続的な関係づくりに活用可能</li>
              </ul>
              <AppButton
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => router.push("/pharmacy")}
              >
                薬局向けの概要を見る
                <ArrowRight className="ml-1 h-3 w-3" />
              </AppButton>
            </div>

            {/* 管理画面ミニイメージ or スクショ用枠 */}
            <div className="relative mx-auto w-full max-w-sm">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
                <LayoutDashboard className="h-3 w-3" />
                <span>店舗・薬剤師を一元管理できる管理画面イメージ</span>
              </div>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900/90">
                {/* ▼ 管理画面（薬剤師一覧 or 店舗一覧）のスクリーンショットを差し替え */}
                <Image
                  src="/images/admin-dashboard.png"
                  alt="ヒトヤク（PharmacyOS） 管理画面イメージ（店舗・薬剤師一覧）"
                  fill
                  className="object-cover opacity-90"
                />
              </div>
            </div>
          </AppCard>
        </section>

        {/* フッター（簡易版） */}
        <footer className="border-t border-slate-200 pt-6 text-[11px] text-slate-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} SASAERU合同会社 / ヒトヤク（PharmacyOS）
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/terms" className="hover:text-slate-700">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-slate-700">
                プライバシーポリシー
              </Link>
              {/* 必要に応じてポータルへの導線も追加 */}
              {/* <Link href="/portal" className="hover:text-slate-700">ポータルサイトへ</Link> */}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
