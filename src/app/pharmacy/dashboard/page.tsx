// src/app/pharmacy/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import {
  Loader2,
  Home,
  Building2,
  Users,
  CalendarClock,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

type DashboardStats = {
  pharmaciesCount: number;
  pharmacistsCount: number;
  patientsCount: number;
  todayAppointmentsCount: number;
};

export default function PharmacyDashboardPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated, role, user } = useUser();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // 認証ガード（念のためクライアント側でもチェック）
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/login");
        return;
      }
      if (role !== "pharmacy_company" && role !== "admin") {
        router.push("/mypage");
      }
    }
  }, [authLoading, isAuthenticated, role, router]);

  // ダッシュボード用のサマリデータ取得
  useEffect(() => {
    if (!isAuthenticated || (role !== "pharmacy_company" && role !== "admin")) return;

    const run = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        // 店舗数
        const { count: pharmaciesCount, error: pharmaciesError } =
          await supabase
            .from("pharmacies")
            .select("*", { count: "exact", head: true });

        if (pharmaciesError) throw pharmaciesError;

        // 薬剤師数
        const { count: pharmacistsCount, error: pharmacistsError } =
          await supabase
            .from("pharmacists")
            .select("*", { count: "exact", head: true });

        if (pharmacistsError) throw pharmacistsError;

        // 患者数
        const { count: patientsCount, error: patientsError } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true });

        if (patientsError) throw patientsError;

        // 今日の予約数（opened_at ベース）
        const today = new Date();
        const start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
          0
        );
        const end = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999
        );

        const { count: todayAppointmentsCount, error: appointmentsError } =
          await supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .gte("opened_at", start.toISOString())
            .lte("opened_at", end.toISOString());

        if (appointmentsError) throw appointmentsError;

        setStats({
          pharmaciesCount: pharmaciesCount ?? 0,
          pharmacistsCount: pharmacistsCount ?? 0,
          patientsCount: patientsCount ?? 0,
          todayAppointmentsCount: todayAppointmentsCount ?? 0,
        });
      } catch (e: any) {
        console.error("[pharmacy/dashboard] stats error", e);
        setStatsError(e.message ?? "サマリ情報の取得に失敗しました。");
      } finally {
        setStatsLoading(false);
      }
    };

    void run();
  }, [isAuthenticated, role]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>薬局ダッシュボードを読み込んでいます...</span>
        </AppCard>
      </div>
    );
  }

  if (!isAuthenticated || (role !== "pharmacy_company" && role !== "admin")) {
    // middleware でリダイレクトされる想定なので通常は一瞬だけ
    return null;
  }

  const displayName =
    (user?.user_metadata?.display_name ??
      user?.user_metadata?.full_name ??
      user?.email ??
      "薬局アカウント") as string;

  return (
    <div className="mx-auto max-w-5xl px-0 py-6 space-y-6 sm:px-0">
      {/* ヘッダー */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Home className="h-7 w-7 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              薬局ダッシュボード
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              法人として登録している店舗・薬剤師・患者・予約の状況をまとめて確認できます。
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="font-medium text-slate-700">{displayName}</p>
          <p className="text-[11px] text-slate-400">
            ロール：{role === "admin" ? "管理者" : "薬局アカウント"}
          </p>
        </div>
      </header>

      {/* サマリカード */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AppCard className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                店舗数
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {statsLoading ? "-" : stats?.pharmaciesCount ?? 0}
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 p-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            className="mt-2 justify-between text-xs"
            onClick={() => router.push("/pharmacy/stores")}
          >
            店舗一覧へ
            <ArrowRight className="ml-1 h-3 w-3" />
          </AppButton>
        </AppCard>

        <AppCard className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                薬剤師数
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {statsLoading ? "-" : stats?.pharmacistsCount ?? 0}
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 p-2">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            className="mt-2 justify-between text-xs"
            onClick={() => router.push("/pharmacy/pharmacists")}
          >
            薬剤師一覧へ
            <ArrowRight className="ml-1 h-3 w-3" />
          </AppButton>
        </AppCard>

        <AppCard className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                登録患者数
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {statsLoading ? "-" : stats?.patientsCount ?? 0}
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 p-2">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            className="mt-2 justify-between text-xs"
            onClick={() => router.push("/pharmacy/bookings")}
          >
            予約・患者一覧へ
            <ArrowRight className="ml-1 h-3 w-3" />
          </AppButton>
        </AppCard>

        <AppCard className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                今日の予約
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {statsLoading ? "-" : stats?.todayAppointmentsCount ?? 0}
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 p-2">
              <CalendarClock className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            className="mt-2 justify-between text-xs"
            onClick={() => router.push("/pharmacy/bookings")}
          >
            今日の予約を確認
            <ArrowRight className="ml-1 h-3 w-3" />
          </AppButton>
        </AppCard>
      </div>

      {/* 下部：案内・今後の拡張枠 */}
      {statsError && (
        <AppCard className="flex items-start gap-2 border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <p>サマリ情報の取得に一部失敗しました。</p>
            <p className="mt-1 text-[11px] text-amber-700">
              {statsError}
            </p>
          </div>
        </AppCard>
      )}

      <AppCard className="space-y-3 p-4 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">
          今後追加予定の機能
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>店舗ごとの患者・予約の集計</li>
          <li>薬剤師ごとの担当患者一覧・稼働状況の可視化</li>
          <li>患者種別（リード / 継続相談 / 終了）ごとのステータス管理</li>
        </ul>
        <p className="mt-1 text-[11px] text-slate-500">
          ※ 現時点では、店舗・薬剤師・患者・予約の基本的な一覧・登録・編集がご利用いただけます。
        </p>
      </AppCard>
    </div>
  );
}
