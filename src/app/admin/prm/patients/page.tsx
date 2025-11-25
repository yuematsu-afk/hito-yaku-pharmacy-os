// src/app/admin/prm/patients/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import type { Pharmacist } from "@/types/supabase";
import type {
  PatientWithPrm,
  RelationStatus,
  PrmPriority,
} from "@/types/prm";

const RELATION_STATUS_LABEL: Record<RelationStatus, string> = {
  lead: "見込み",
  active: "対応中",
  advisor: "顧問中",
  ended: "対応終了",
};

const PRIORITY_LABEL: Record<PrmPriority, string> = {
  1: "高",
  2: "中",
  3: "低",
};

type StatusFilter = "all" | RelationStatus;
type PriorityFilter = "all" | PrmPriority;

interface FilterState {
  status: StatusFilter;
  priority: PriorityFilter;
  sort: "next_contact" | "priority" | "status";
  keyword: string;
}

const STORAGE_KEY = "prmPatientsListFilters_v2";

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isOverdueNextContact(
  next_contact_at: string | null,
  relation_status: RelationStatus,
): boolean {
  if (!next_contact_at) return false;
  if (relation_status !== "active" && relation_status !== "advisor")
    return false;
  const d = new Date(next_contact_at);
  const today = new Date();
  // シンプルに「現在時刻より過去」を期限超過とみなす
  return d.getTime() < today.getTime();
}

export default function PrmPatientsListPage() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientWithPrm[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [error, setError] = useState<string | null>(null);

  // フィルタ状態（localStorage から初期化するまで null）
  const [filters, setFilters] = useState<FilterState | null>(null);

  // ✅ マウント時に localStorage からフィルタ状態を読み込む
  useEffect(() => {
    if (typeof window === "undefined") {
      // SSR 時は何もしない
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setFilters({
          status: "all",
          priority: "all",
          sort: "next_contact",
          keyword: "",
        });
        return;
      }
      const parsed = JSON.parse(raw) as Partial<FilterState>;
      setFilters({
        status: (parsed.status as StatusFilter) ?? "all",
        priority: (parsed.priority as PriorityFilter) ?? "all",
        sort: parsed.sort ?? "next_contact",
        keyword: parsed.keyword ?? "",
      });
    } catch {
      setFilters({
        status: "all",
        priority: "all",
        sort: "next_contact",
        keyword: "",
      });
    }
  }, []);

  // ✅ データ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: patientRows, error: patientError } = await supabase
          .from("patients")
          .select("*")
          .order("next_contact_at", { ascending: true });

        if (patientError) throw patientError;

        const { data: pharmacistRows, error: pharmacistError } = await supabase
          .from("pharmacists")
          .select("*");

        if (pharmacistError) throw pharmacistError;

        setPatients((patientRows ?? []) as PatientWithPrm[]);
        setPharmacists(pharmacistRows ?? []);
      } catch (err: any) {
        console.error("Failed to fetch PRM patients", err);
        setError(err.message ?? "データ取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ✅ フィルタ変更時に localStorage に保存（filters が null の間は動かさない）
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!filters) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  // pharmacist.id -> name
  const pharmacistNameMap = useMemo(() => {
    const map = new Map<string, string>();
    pharmacists.forEach((p) => {
      if (p.id) map.set(p.id as string, (p as any).name ?? "名称未設定");
    });
    return map;
  }, [pharmacists]);

  // ✅ フィルタ・ソート後のリスト
  const filtered = useMemo(() => {
    if (!filters) return patients; // 初期ロード中はそのまま

    const { status, priority, sort, keyword } = filters;
    const lowerKeyword = keyword.trim().toLowerCase();

    let list = [...patients];

    if (status !== "all") {
      list = list.filter((p) => p.relation_status === status);
    }

    if (priority !== "all") {
      list = list.filter((p) => p.priority === priority);
    }

    if (lowerKeyword) {
      list = list.filter((p) => {
        const name = ((p as any).name ?? "").toLowerCase();
        const email = ((p as any).email ?? "").toLowerCase();
        const tagsText = (p.tags ?? []).join(" ").toLowerCase();
        return (
          name.includes(lowerKeyword) ||
          email.includes(lowerKeyword) ||
          tagsText.includes(lowerKeyword)
        );
      });
    }

    list.sort((a, b) => {
      if (sort === "next_contact") {
        const aTime = a.next_contact_at
          ? new Date(a.next_contact_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.next_contact_at
          ? new Date(b.next_contact_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }

      if (sort === "priority") {
        return a.priority - b.priority; // 1(高) → 3(低)
      }

      if (sort === "status") {
        const order: RelationStatus[] = ["advisor", "active", "lead", "ended"];
        const aIdx = order.indexOf(a.relation_status);
        const bIdx = order.indexOf(b.relation_status);
        return aIdx - bIdx;
      }

      return 0;
    });

    return list;
  }, [patients, filters]);

  // ステータスバッジ
  const renderStatusBadge = (status: RelationStatus) => {
    let base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
    if (status === "advisor") {
      base += " bg-emerald-50 text-emerald-700 border border-emerald-100";
    } else if (status === "active") {
      base += " bg-sky-50 text-sky-700 border border-sky-100";
    } else if (status === "lead") {
      base += " bg-slate-50 text-slate-700 border border-slate-100";
    } else {
      base += " bg-slate-100 text-slate-500 border border-slate-200";
    }
    return <span className={base}>{RELATION_STATUS_LABEL[status]}</span>;
  };

  // 優先度バッジ
  const renderPriorityBadge = (priority: PrmPriority) => {
    let base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
    if (priority === 1) {
      base += " bg-red-50 text-red-700 border border-red-100";
    } else if (priority === 2) {
      base += " bg-amber-50 text-amber-700 border border-amber-100";
    } else {
      base += " bg-slate-50 text-slate-600 border border-slate-100";
    }
    return <span className={base}>{PRIORITY_LABEL[priority]}</span>;
  };

  // filters がまだロードされていない間は軽いローディング表示
  if (!filters) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <AppCard className="py-10 text-center text-sm text-slate-500">
          条件を読み込み中です…
        </AppCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            患者一覧（PRM）
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            顧問候補〜顧問中の患者を一覧で管理します。ステータス・優先度・フォロー予定日で絞り込みできます。
          </p>
        </div>
      </div>

      {/* フィルタバー */}
      <AppCard className="space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          {/* ステータス */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              ステータス
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) =>
                  prev
                    ? { ...prev, status: e.target.value as StatusFilter }
                    : prev,
                )
              }
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">すべて</option>
              <option value="lead">見込み</option>
              <option value="active">対応中</option>
              <option value="advisor">顧問中</option>
              <option value="ended">対応終了</option>
            </select>
          </div>

          {/* 優先度 */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              優先度
            </label>
            <select
              value={filters.priority}
              onChange={(e) =>
                setFilters((prev) =>
                  prev
                    ? {
                        ...prev,
                        priority:
                          e.target.value === "all"
                            ? "all"
                            : (Number(e.target.value) as PrmPriority),
                      }
                    : prev,
                )
              }
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">すべて</option>
              <option value={1}>高</option>
              <option value={2}>中</option>
              <option value={3}>低</option>
            </select>
          </div>

          {/* 並び順 */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              並び順
            </label>
            <select
              value={filters.sort}
              onChange={(e) =>
                setFilters((prev) =>
                  prev
                    ? {
                        ...prev,
                        sort: e.target.value as FilterState["sort"],
                      }
                    : prev,
                )
              }
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="next_contact">次回フォロー日が近い順</option>
              <option value="priority">優先度（高い→低い）</option>
              <option value="status">
                ステータス（顧問→対応中→見込み→終了）
              </option>
            </select>
          </div>

          {/* キーワード */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              キーワード
            </label>
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) =>
                setFilters((prev) =>
                  prev ? { ...prev, keyword: e.target.value } : prev,
                )
              }
              placeholder="名前 / メール / タグで検索"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
        </div>
      </AppCard>

      {/* 本体 */}
      {loading ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          読み込み中です…
        </AppCard>
      ) : error ? (
        <AppCard className="py-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </AppCard>
      ) : filtered.length === 0 ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          条件に一致する患者がいません。
          フィルタ条件を変更して再度お試しください。
        </AppCard>
      ) : (
        <AppCard className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">患者</th>
                <th className="px-3 py-2 text-left font-medium">ステータス</th>
                <th className="px-3 py-2 text-left font-medium">優先度</th>
                <th className="px-3 py-2 text-left font-medium">
                  メイン担当薬剤師
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  次回フォロー予定
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  最終フォロー
                </th>
                <th className="px-3 py-2 text-left font-medium">タグ</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const name = (p as any).name ?? "（名称未設定）";
                const email = (p as any).email ?? "";
                const mainPharmacistName =
                  p.main_pharmacist_id &&
                  pharmacistNameMap.get(p.main_pharmacist_id)
                    ? pharmacistNameMap.get(p.main_pharmacist_id)!
                    : "未設定";

                const overdue = isOverdueNextContact(
                  p.next_contact_at,
                  p.relation_status,
                );

                const nextContactText = formatDate(p.next_contact_at);
                const lastContactText = formatDate(p.last_contact_at);

                const firstTags = (p.tags ?? []).slice(0, 3);
                const moreTagCount =
                  (p.tags?.length ?? 0) > 3
                    ? (p.tags!.length ?? 0) - firstTags.length
                    : 0;

                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-900">{name}</div>
                      {email && (
                        <div className="text-[11px] text-slate-500">
                          {email}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {renderStatusBadge(p.relation_status)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {renderPriorityBadge(p.priority)}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      {mainPharmacistName}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div
                        className={
                          "text-[11px] sm:text-xs " +
                          (overdue
                            ? "text-red-600 font-semibold"
                            : "text-slate-700")
                        }
                      >
                        {nextContactText}
                        {overdue && (
                          <span className="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                            期限超過
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-[11px] sm:text-xs text-slate-700">
                        {lastContactText}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {firstTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                        {moreTagCount > 0 && (
                          <span className="text-[10px] text-slate-400">
                            +{moreTagCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Link href={`/admin/prm/patients/${p.id}`}>
                        <AppButton variant="outline" size="sm">
                          詳細・編集
                        </AppButton>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AppCard>
      )}
    </div>
  );
}
