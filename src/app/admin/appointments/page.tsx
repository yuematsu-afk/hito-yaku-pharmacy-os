// src/app/admin/appointments/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Patient, Pharmacist, PatientType } from "@/types/supabase";
import { AppCard } from "@/components/ui/app-card";

type BookingType = "phone" | "online" | "in_person";

// 診断側と揃えた相談スタイルキー
type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

interface Appointment {
  id: string;
  patient_id: string | null;
  pharmacist_id: string | null;
  booking_type: BookingType | null;
  memo: string | null;
  booking_url: string | null;
  opened_at: string | null;
  created_at?: string | null;
  // 追加している場合だけ使われる想定（なければすべて null）
  contact?: string | null;
}

interface AppointmentWithNames extends Appointment {
  patient_name: string;
  patient_type: PatientType | null;
  patient_type_label: string;
  care_style: CareStyleKey | null;
  care_style_label: string;
  contact: string | null;
  pharmacist_name: string;
}

const BOOKING_TYPE_LABEL: Record<BookingType, string> = {
  phone: "電話相談",
  online: "オンライン相談",
  in_person: "店舗相談",
};

const PATIENT_TYPE_LABEL: Record<PatientType, string> = {
  A: "タイプA：専門性重視タイプ",
  B: "タイプB：生活支援タイプ",
  C: "タイプC：メンタル×体質タイプ",
  D: "タイプD：外国語対応タイプ",
};

const CARE_STYLE_LABEL: Record<CareStyleKey, string> = {
  understanding: "理解タイプ",
  empathy: "気持ちタイプ",
  expert: "おまかせタイプ",
  support: "継続苦手タイプ",
  family: "家族タイプ",
  second_opinion: "比較タイプ",
};

// patients.note から「連絡先: 〜」を抜き出す
function extractLatestContact(note: string | null | undefined): string | null {
  if (!note) return null;
  const lines = note
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  // 一番下の行を優先
  const last = lines[lines.length - 1];

  const m = last.match(/連絡先[:：]\s*(.+)$/);
  if (m && m[1]) {
    return m[1].trim();
  }

  // うまく取れなければ null
  return null;
}

// JST 表示用（ブラウザのタイムゾーンは日本想定だが、念のため文字列から組み立て）
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "―";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "―";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルタ用
  const [bookingTypeFilter, setBookingTypeFilter] = useState<
    BookingType | "all"
  >("all");
  const [pharmacistFilter, setPharmacistFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>(""); // yyyy-mm-dd

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. appointments を取得
        const { data: appts, error: apptError } = await supabase
          .from("appointments")
          .select("*")
          .order("opened_at", { ascending: false })
          .returns<Appointment[]>();

        if (apptError) {
          console.error(apptError);
          setError("予約ログの取得に失敗しました。");
          setLoading(false);
          return;
        }

        if (!appts || appts.length === 0) {
          setAppointments([]);
          setLoading(false);
          return;
        }

        // 2. 関連する patient / pharmacist をまとめて取得
        const patientIds = Array.from(
          new Set(
            appts
              .map((a) => a.patient_id)
              .filter((x): x is string => !!x)
          )
        );
        const pharmacistIds = Array.from(
          new Set(
            appts
              .map((a) => a.pharmacist_id)
              .filter((x): x is string => !!x)
          )
        );

        let patients: Pick<
          Patient,
          "id" | "name" | "type" | "care_style" | "note"
        >[] = [];
        let pharmacists: Pick<Pharmacist, "id" | "name">[] = [];

        if (patientIds.length > 0) {
          const { data: pData } = await supabase
            .from("patients")
            .select("id, name, type, care_style, note")
            .in("id", patientIds)
            .returns<
              Pick<Patient, "id" | "name" | "type" | "care_style" | "note">[]
            >();
          patients = pData ?? [];
        }

        if (pharmacistIds.length > 0) {
          const { data: phData } = await supabase
            .from("pharmacists")
            .select("id, name")
            .in("id", pharmacistIds)
            .returns<Pick<Pharmacist, "id" | "name">[]>();
          pharmacists = phData ?? [];
        }

        const patientMap = new Map<
          string,
          Pick<Patient, "id" | "name" | "type" | "care_style" | "note">
        >();
        const pharmacistMap = new Map<string, Pick<Pharmacist, "id" | "name">>();

        patients.forEach((p) => {
          patientMap.set(p.id, p);
        });
        pharmacists.forEach((ph) => {
          pharmacistMap.set(ph.id, ph);
        });

        const withNames: AppointmentWithNames[] = appts.map((a) => {
          const patient = a.patient_id ? patientMap.get(a.patient_id) : null;
          const pharmacist = a.pharmacist_id
            ? pharmacistMap.get(a.pharmacist_id)
            : null;

          const pTypeRaw = patient?.type as PatientType | null | undefined;
          const pType: PatientType | null =
            pTypeRaw && ["A", "B", "C", "D"].includes(pTypeRaw as string)
              ? (pTypeRaw as PatientType)
              : null;

          const careRaw = patient?.care_style as
            | CareStyleKey
            | null
            | undefined;
          const careStyle: CareStyleKey | null =
            careRaw && CARE_STYLE_LABEL[careRaw as CareStyleKey]
              ? (careRaw as CareStyleKey)
              : null;

          // 連絡先：appointments.contact があればそれを使い、なければ note から抽出
          const contact =
            (a.contact ?? null) ??
            extractLatestContact((patient?.note as string | null) ?? null);

          return {
            ...a,
            patient_name: patient?.name ?? "（患者未設定）",
            patient_type: pType,
            patient_type_label: pType ? PATIENT_TYPE_LABEL[pType] : "（未設定）",
            care_style: careStyle,
            care_style_label: careStyle
              ? CARE_STYLE_LABEL[careStyle]
              : "（未設定）",
            contact,
            pharmacist_name: pharmacist?.name ?? "（薬剤師未設定）",
          };
        });

        setAppointments(withNames);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("予約ログの読み込み中にエラーが発生しました。");
        setLoading(false);
      }
    };

    void run();
  }, []);

  // 薬剤師フィルタ用選択肢
  const pharmacistOptions = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((a) => {
      if (a.pharmacist_id && a.pharmacist_name) {
        map.set(a.pharmacist_id, a.pharmacist_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      // 予約種別
      if (bookingTypeFilter !== "all") {
        if (a.booking_type !== bookingTypeFilter) return false;
      }

      // 薬剤師別
      if (pharmacistFilter !== "all") {
        if (a.pharmacist_id !== pharmacistFilter) return false;
      }

      const opened = a.opened_at ?? a.created_at ?? null;
      if (!opened) return false;
      const openedDate = new Date(opened);

      // 期間（From）
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00+09:00`);
        if (openedDate < from) return false;
      }

      // 期間（To）
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59+09:00`);
        if (openedDate > to) return false;
      }

      return true;
    });
  }, [appointments, bookingTypeFilter, pharmacistFilter, dateFrom, dateTo]);

  return (
    <div className="max-w-6xl space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">予約ログ一覧</h1>
          <p className="mt-1 text-xs text-slate-600">
            顧問薬剤師マッチング結果から、Googleカレンダーや電話相談・店舗相談に進んだ履歴を確認できます。
          </p>
        </div>
        <a
          href="/admin/dashboard"
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
        >
          管理ダッシュボードにもどる
        </a>
      </div>

      {/* フィルタ＆概要 */}
      <AppCard className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs">
          {/* 左側：種別＋薬剤師フィルタ */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-700 font-semibold">
                予約種別で絞り込み
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setBookingTypeFilter("all")}
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    bookingTypeFilter === "all"
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  すべて
                </button>
                <button
                  type="button"
                  onClick={() => setBookingTypeFilter("phone")}
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    bookingTypeFilter === "phone"
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  電話相談
                </button>
                <button
                  type="button"
                  onClick={() => setBookingTypeFilter("online")}
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    bookingTypeFilter === "online"
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  オンライン相談
                </button>
                <button
                  type="button"
                  onClick={() => setBookingTypeFilter("in_person")}
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    bookingTypeFilter === "in_person"
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  店舗相談
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-700 font-semibold">
                薬剤師で絞り込み
              </span>
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] bg-white"
                value={pharmacistFilter}
                onChange={(e) => setPharmacistFilter(e.target.value)}
              >
                <option value="all">すべて</option>
                {pharmacistOptions.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 右側：期間フィルタ＋件数 */}
          <div className="space-y-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">期間</span>
              <input
                type="date"
                className="rounded-md border border-slate-300 px-2 py-1"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span>〜</span>
              <input
                type="date"
                className="rounded-md border border-slate-300 px-2 py-1"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="ml-1 rounded-full border border-slate-300 px-2 py-0.5 hover:bg-slate-50"
                >
                  クリア
                </button>
              )}
            </div>
            <div className="text-right">
              表示件数：{filteredAppointments.length}件 / 全
              {appointments.length}件
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          「電話相談」「店舗相談」の場合は、マッチング結果画面の下部フォーム（連絡先入力）に誘導されたログです。
          「オンライン相談」は Googleカレンダーの予約ページを開いた履歴です。
        </p>
      </AppCard>

      {/* 一覧テーブル */}
      <AppCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-slate-600">
            予約ログを読み込み中です...
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-700">{error}</div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">
            条件に合致する予約ログがまだありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    開いた日時
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    患者
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    患者タイプ
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    相談スタイル
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    連絡先
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    薬剤師
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    予約方法
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">
                    希望メモ
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">
                    予約ページ
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {formatDateTime(a.opened_at ?? a.created_at ?? null)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {a.patient_name}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {a.patient_type_label}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {a.care_style_label}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {a.contact ? (
                        <span className="text-slate-800">{a.contact}</span>
                      ) : (
                        <span className="text-slate-400">（未入力）</span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {a.pharmacist_name}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {a.booking_type
                        ? BOOKING_TYPE_LABEL[a.booking_type]
                        : "（未設定）"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top">
                      {a.memo ? (
                        <span className="whitespace-pre-wrap text-slate-700">
                          {a.memo}
                        </span>
                      ) : (
                        <span className="text-slate-400">（なし）</span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top whitespace-nowrap">
                      {a.booking_url ? (
                        <a
                          href={a.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-sky-700 underline underline-offset-2"
                        >
                          カレンダーを開く
                        </a>
                      ) : (
                        <span className="text-slate-400">―</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>
    </div>
  );
}
