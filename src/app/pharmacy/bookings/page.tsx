// src/app/pharmacy/bookings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import type { Patient, Pharmacist, Pharmacy } from "@/types/supabase";
import {
  Loader2,
  AlertCircle,
  CalendarClock,
  User,
  UserCircle2,
  Hospital,
  Phone,
  MessageCircle,
  ExternalLink,
  Filter,
} from "lucide-react";

type BookingType = "phone" | "online" | "in_person";

type AppointmentCore = {
  id: string;
  patient_id: string;
  pharmacist_id: string;
  booking_type: BookingType | null;
  memo: string | null;
  booking_url: string | null;
  opened_at: string; // timestamptz
  created_at: string;
  contact: string | null;
};

type AppointmentWithRelations = AppointmentCore & {
  patient: Patient | null;
  pharmacist: Pharmacist | null;
};

interface AppointmentRow extends AppointmentWithRelations {
  pharmacy: Pharmacy | null;
}

type PeriodFilter = "upcoming" | "recent30" | "all";

export default function PharmacyBookingsPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated, role } = useUser();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AppointmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // フィルタ
  const [keyword, setKeyword] = useState("");
  const [bookingTypeFilter, setBookingTypeFilter] =
    useState<"all" | BookingType>("all");
  const [periodFilter, setPeriodFilter] =
    useState<PeriodFilter>("upcoming");
  const [pharmacistFilter, setPharmacistFilter] =
    useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");

  // 認証ガード
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

  // データ取得
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) 予約（患者・薬剤師をリレーション取得）
        const { data: appointmentsData, error: apError } = await supabase
          .from("appointments")
          .select(
            `
            id,
            patient_id,
            pharmacist_id,
            booking_type,
            memo,
            booking_url,
            opened_at,
            created_at,
            contact,
            patient:patients(*),
            pharmacist:pharmacists(*)
          `
          )
          .order("opened_at", { ascending: false })
          .returns<AppointmentWithRelations[]>();

        if (apError) throw apError;

        // 2) 店舗一覧
        const { data: pharmaciesData, error: pmError } = await supabase
          .from("pharmacies")
          .select("*")
          .returns<Pharmacy[]>();

        if (pmError) throw pmError;

        const pharmacyMap = new Map<string, Pharmacy>();
        (pharmaciesData ?? []).forEach((p) => {
          if (p.id) pharmacyMap.set(p.id, p);
        });

        // 3) appointments × pharmacist.belongs_pharmacy_id で店舗を紐付け
        const merged: AppointmentRow[] = (appointmentsData ?? []).map(
          (a) => {
            const ph = a.pharmacist;
            const pharmacy =
              ph?.belongs_pharmacy_id &&
              pharmacyMap.has(ph.belongs_pharmacy_id)
                ? pharmacyMap.get(ph.belongs_pharmacy_id)!
                : null;

            return {
              ...a,
              pharmacy,
            };
          }
        );

        setItems(merged);
      } catch (e: any) {
        console.error("[pharmacy/bookings] fetch error", e);
        setError(e.message ?? "予約・患者情報の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  // フィルタ用の選択肢
  const pharmacistOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((row) => {
      if (row.pharmacist?.id && row.pharmacist.name) {
        map.set(row.pharmacist.id, row.pharmacist.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [items]);

  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((row) => {
      if (row.pharmacy?.id && row.pharmacy.name) {
        map.set(row.pharmacy.id, row.pharmacy.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [items]);

  // フィルタ適用
  const filteredItems = useMemo(() => {
    const now = new Date();
    const kw = keyword.trim().toLowerCase();

    return items.filter((row) => {
      const {
        patient,
        pharmacist,
        pharmacy,
        booking_type,
        opened_at,
        memo,
        contact,
      } = row;

      // キーワード（患者名・薬剤師名・店舗名・メモ・連絡先など）
      if (kw) {
        const bucket = [
          patient?.name ?? "",
          patient?.email ?? "",
          pharmacist?.name ?? "",
          pharmacy?.name ?? "",
          memo ?? "",
          contact ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!bucket.includes(kw)) return false;
      }

      // 予約種別
      if (bookingTypeFilter !== "all") {
        if (booking_type !== bookingTypeFilter) return false;
      }

      // 担当薬剤師
      if (pharmacistFilter !== "all") {
        if (!pharmacist || pharmacist.id !== pharmacistFilter)
          return false;
      }

      // 店舗
      if (storeFilter !== "all") {
        if (!pharmacy || pharmacy.id !== storeFilter) return false;
      }

      // 期間フィルタ
      if (periodFilter !== "all") {
        const opened = opened_at ? new Date(opened_at) : null;
        if (!opened) return false;

        if (periodFilter === "upcoming") {
          // 今日以降
          if (opened < new Date(now.toDateString())) return false;
        } else if (periodFilter === "recent30") {
          const diffMs = now.getTime() - opened.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [
    items,
    keyword,
    bookingTypeFilter,
    pharmacistFilter,
    storeFilter,
    periodFilter,
  ]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>予約情報を準備しています...</span>
        </AppCard>
      </div>
    );
  }

  if (!isAuthenticated || (role !== "pharmacy_company" && role !== "admin")) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              予約・患者一覧（法人用）
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              各薬剤師に紐づく患者さんの予約状況と、予約時に入力された連絡先・メモを一覧で確認できます。
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <AppButton
            size="sm"
            variant="outline"
            onClick={() => router.push("/pharmacy/dashboard")}
          >
            ダッシュボードにもどる
          </AppButton>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <AppCard className="space-y-1 border-red-200 bg-red-50/80 text-xs text-red-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            データ取得エラー
          </div>
          <p>{error}</p>
        </AppCard>
      )}

      {/* フィルタバー */}
      <AppCard className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <Filter className="h-4 w-4 text-slate-500" />
          絞り込み
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* キーワード */}
          <div>
            <label className="text-[11px] font-medium text-slate-700">
              キーワード
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="患者名 / 薬剤師名 / 店舗名 / 連絡先 / メモ など"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>

          {/* 予約種別 */}
          <div>
            <label className="text-[11px] font-medium text-slate-700">
              相談方法
            </label>
            <select
              value={bookingTypeFilter}
              onChange={(e) =>
                setBookingTypeFilter(
                  e.target.value === "all"
                    ? "all"
                    : (e.target.value as BookingType)
                )
              }
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">すべて</option>
              <option value="online">オンライン</option>
              <option value="phone">電話</option>
              <option value="in_person">対面</option>
            </select>
          </div>

          {/* 期間 */}
          <div>
            <label className="text-[11px] font-medium text-slate-700">
              期間
            </label>
            <select
              value={periodFilter}
              onChange={(e) =>
                setPeriodFilter(e.target.value as PeriodFilter)
              }
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="upcoming">今日以降の予約</option>
              <option value="recent30">直近30日</option>
              <option value="all">すべて</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {/* 薬剤師フィルタ */}
          <div>
            <label className="text-[11px] font-medium text-slate-700">
              担当薬剤師
            </label>
            <select
              value={pharmacistFilter}
              onChange={(e) => setPharmacistFilter(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">すべて</option>
              {pharmacistOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 店舗フィルタ */}
          <div>
            <label className="text-[11px] font-medium text-slate-700">
              店舗
            </label>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">すべて</option>
              {storeOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          該当件数：{filteredItems.length} 件 / 全 {items.length} 件
        </div>
      </AppCard>

      {/* 本体 */}
      {loading ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
          読み込み中です…
        </AppCard>
      ) : filteredItems.length === 0 ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          条件に一致する予約がありません。
        </AppCard>
      ) : (
        <AppCard className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">日時</th>
                <th className="px-3 py-2 text-left font-medium">患者</th>
                <th className="px-3 py-2 text-left font-medium">
                  薬剤師・店舗
                </th>
                <th className="px-3 py-2 text-left font-medium">方法</th>
                <th className="px-3 py-2 text-left font-medium">
                  予約メモ
                </th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => {
                const opened = row.opened_at
                  ? new Date(row.opened_at)
                  : null;

                const openedText = opened
                  ? `${opened.toLocaleDateString()} ${opened.toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}`
                  : "-";

                const bookingLabel =
                  row.booking_type === "online"
                    ? "オンライン"
                    : row.booking_type === "phone"
                    ? "電話"
                    : row.booking_type === "in_person"
                    ? "対面"
                    : "未設定";

                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    {/* 日時 */}
                    <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700">
                      <div className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3 text-slate-400" />
                        <span>{openedText}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        登録：
                        {new Date(
                          row.created_at
                        ).toLocaleDateString()}
                      </div>
                    </td>

                    {/* 患者 */}
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1 text-slate-800">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>
                          {row.patient?.name ?? "（氏名未入力）"}
                        </span>
                      </div>

                      {/* 患者メールアドレス */}
                      {row.patient?.email && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                          <MessageCircle className="h-3 w-3" />
                          <span>{row.patient.email}</span>
                        </div>
                      )}

                      {/* 予約時に入力された連絡先（appointments.contact） */}
                      {row.contact && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-700">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>予約時連絡先：{row.contact}</span>
                        </div>
                      )}
                    </td>

                    {/* 薬剤師・店舗 */}
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1 text-slate-800">
                        <UserCircle2 className="h-3 w-3 text-slate-400" />
                        <span>
                          {row.pharmacist?.name ?? "（未割り当て）"}
                        </span>
                      </div>
                      {row.pharmacy && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                          <Hospital className="h-3 w-3" />
                          <span>{row.pharmacy.name}</span>
                          {row.pharmacy.area && (
                            <span className="text-slate-400">
                              （{row.pharmacy.area}）
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 方法 */}
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700">
                        {bookingLabel}
                      </span>
                    </td>

                    {/* 予約メモ */}
                    <td className="px-3 py-2 align-top">
                      {row.memo ? (
                        <div className="text-[11px] text-slate-600">
                          {row.memo.length > 80
                            ? `${row.memo.slice(0, 80)}…`
                            : row.memo}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          メモなし
                        </span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="px-3 py-2 align-top text-right">
                      <div className="flex justify-end gap-2">
                        {row.booking_url && (
                          <AppButton
                            variant="outline"
                            size="sm"
                            className="text-[11px]"
                            type="button"
                            onClick={() =>
                              window.open(
                                row.booking_url!,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            予約画面
                          </AppButton>
                        )}
                      </div>
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
