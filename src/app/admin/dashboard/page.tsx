// src/app/admin/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";

// Recharts
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

interface Summary {
  advisorCount: number;
  activeCount: number;
  leadCount: number;
  endedCount: number;
  nextWeekFollowCount: number;
  weeklyLogCount: number;
  pharmacistRanking: {
    pharmacist_id: string;
    name: string;
    count: number;
  }[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 基準日時（患者・ログどちらの集計にも使う）
        const now = new Date();
        const oneWeekLater = new Date();
        oneWeekLater.setDate(now.getDate() + 7);

        // 患者データを取得
        const { data: patients, error: patientError } = await supabase
          .from("patients")
          .select("*");

        if (patientError) throw patientError;

        // 薬剤師データ（ランキング用）
        const { data: pharmacists, error: pharmacistError } = await supabase
          .from("pharmacists")
          .select("*");

        if (pharmacistError) throw pharmacistError;

        let advisorCount = 0;
        let activeCount = 0;
        let leadCount = 0;
        let endedCount = 0;
        let nextWeekFollowCount = 0;

        const pharmacistMap: Record<string, number> = {};

        (patients ?? []).forEach((p: any) => {
          // ステータス集計
          if (p.relation_status === "advisor") advisorCount++;
          if (p.relation_status === "active") activeCount++;
          if (p.relation_status === "lead") leadCount++;
          if (p.relation_status === "ended") endedCount++;

          // フォロー予定（今週）
          if (p.next_contact_at) {
            const d = new Date(p.next_contact_at);
            if (d >= now && d <= oneWeekLater) {
              nextWeekFollowCount++;
            }
          }

          // 担当薬剤師ランキング
          if (p.main_pharmacist_id) {
            pharmacistMap[p.main_pharmacist_id] =
              (pharmacistMap[p.main_pharmacist_id] ?? 0) + 1;
          }
        });

        const pharmacistRanking = Object.entries(pharmacistMap)
          .map(([id, count]) => {
            const ph = pharmacists?.find((x: any) => x.id === id);
            return {
              pharmacist_id: id,
              name: ph?.name ?? "名称未設定",
              count,
            };
          })
          .sort((a, b) => b.count - a.count);

        // 今週の相談ログを取得
        const { data: logs, error: logError } = await supabase
          .from("patient_logs")
          .select("id, contact_at");

        if (logError) throw logError;

        const weeklyLogCount = (logs ?? []).filter((log: any) => {
          const d = new Date(log.contact_at);
          return d >= now && d <= oneWeekLater;
        }).length;

        setSummary({
          advisorCount,
          activeCount,
          leadCount,
          endedCount,
          nextWeekFollowCount,
          weeklyLogCount,
          pharmacistRanking,
        });
      } catch (err: any) {
        console.error("Dashboard load error", err);
        setError(err.message ?? "読み込みエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        薬局ダッシュボード
      </h1>
      <p className="text-sm text-slate-500">
        顧問患者、フォロー予定、薬剤師別担当状況を確認できます。
      </p>

      {loading ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          読み込み中…
        </AppCard>
      ) : error ? (
        <AppCard className="py-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </AppCard>
      ) : !summary ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          データがありません
        </AppCard>
      ) : (
        <>
          {/* KPI カード 4つ */}
          <div className="grid gap-4 sm:grid-cols-4">
            <AppCard className="p-4">
              <div className="text-xs text-slate-500">顧問中（advisor）</div>
              <div className="text-3xl font-semibold text-slate-900">
                {summary.advisorCount}
              </div>
            </AppCard>

            <AppCard className="p-4">
              <div className="text-xs text-slate-500">対応中（active）</div>
              <div className="text-3xl font-semibold text-slate-900">
                {summary.activeCount}
              </div>
            </AppCard>

            <AppCard className="p-4">
              <div className="text-xs text-slate-500">
                今週フォロー予定（7日以内）
              </div>
              <div className="text-3xl font-semibold text-slate-900">
                {summary.nextWeekFollowCount}
              </div>
            </AppCard>

            <AppCard className="p-4">
              <div className="text-xs text-slate-500">今週の相談ログ数</div>
              <div className="text-3xl font-semibold text-slate-900">
                {summary.weeklyLogCount}
              </div>
            </AppCard>
            <a
            href="/admin/appointments"
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
            >
            予約ログを見る
            </a>
          </div>

          {/* ステータス構成：円グラフ */}
          <AppCard className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              患者ステータス構成（全体）
            </h2>

            <div className="w-full flex justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "見込み (lead)",
                        value: summary.leadCount,
                      },
                      {
                        name: "対応中 (active)",
                        value: summary.activeCount,
                      },
                      {
                        name: "顧問中 (advisor)",
                        value: summary.advisorCount,
                      },
                      {
                        name: "終了 (ended)",
                        value: summary.endedCount,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#94a3b8" /> {/* lead */}
                    <Cell fill="#38bdf8" /> {/* active */}
                    <Cell fill="#34d399" /> {/* advisor */}
                    <Cell fill="#cbd5e1" /> {/* ended */}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </AppCard>

          {/* 薬剤師ランキング：棒グラフ */}
          <AppCard className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              薬剤師別担当患者数（棒グラフ）
            </h2>

            {summary.pharmacistRanking.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                データがありません。
              </div>
            ) : (
              <div className="w-full mt-4">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={summary.pharmacistRanking.map((ph) => ({
                      name: ph.name,
                      count: ph.count,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#38bdf8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </AppCard>

          {/* 薬剤師ランキング（リスト） */}
          <AppCard className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              担当患者数ランキング（薬剤師）
            </h2>
            {summary.pharmacistRanking.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                担当薬剤師のデータがありません。
              </div>
            ) : (
              <div className="space-y-2">
                {summary.pharmacistRanking.map((ph) => (
                  <div
                    key={ph.pharmacist_id}
                    className="flex justify-between border-b pb-1 text-sm"
                  >
                    <span>{ph.name}</span>
                    <span className="font-semibold">{ph.count} 人</span>
                  </div>
                ))}
              </div>
            )}
          </AppCard>
        </>
      )}
    </div>
  );
}
