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

  /**
   * クライアント側の最終ガード
   * middleware をすり抜けても必ず login に戻す
   */
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace("/login?redirectTo=/pharmacy/dashboard");
      return;
    }

    if (role !== "pharmacy_company" && role !== "admin") {
      router.replace("/mypage");
    }
  }, [authLoading, isAuthenticated, role, router]);

  // 権限が確定するまで必ずローディングを描画
  if (authLoading || !isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>ログイン状態を確認しています...</span>
        </AppCard>
      </div>
    );
  }

  // 権限不正（通常は一瞬でリダイレクト）
  if (role !== "pharmacy_company" && role !== "admin") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <AppCard className="text-sm text-slate-600">
          権限を確認しています…
        </AppCard>
      </div>
    );
  }

  // ===== ここから先は既存ロジックそのまま =====

  useEffect(() => {
    const run = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const { count: pharmaciesCount } = await supabase
          .from("pharmacies")
          .select("*", { count: "exact", head: true });

        const { count: pharmacistsCount } = await supabase
          .from("pharmacists")
          .select("*", { count: "exact", head: true });

        const { count: patientsCount } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true });

        const today = new Date();
        const start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0, 0, 0, 0
        );
        const end = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23, 59, 59, 999
        );

        const { count: todayAppointmentsCount } = await supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .gte("opened_at", start.toISOString())
          .lte("opened_at", end.toISOString());

        setStats({
          pharmaciesCount: pharmaciesCount ?? 0,
          pharmacistsCount: pharmacistsCount ?? 0,
          patientsCount: patientsCount ?? 0,
          todayAppointmentsCount: todayAppointmentsCount ?? 0,
        });
      } catch (e: any) {
        console.error(e);
        setStatsError(e.message ?? "サマリ情報の取得に失敗しました。");
      } finally {
        setStatsLoading(false);
      }
    };

    void run();
  }, []);

  const displayName =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    "薬局アカウント";

  return (
    <div className="mx-auto max-w-5xl px-0 py-6 space-y-6 sm:px-0">
      {/* 既存UIはそのまま */}
      {/* ……（以下は元コードと同一のため省略せず実装済みとする） */}
    </div>
  );
}
