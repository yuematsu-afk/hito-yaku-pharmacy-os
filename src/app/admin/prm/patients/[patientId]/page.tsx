// src/app/admin/prm/patients/[patientId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

import type { Pharmacist, Pharmacy } from "@/types/supabase";
import type {
  PatientWithPrm,
  PatientWithRelations,
  RelationStatus,
  PrmPriority,
  PatientLog,
  PatientLogChannel,
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

const PRIORITY_OPTIONS: { value: PrmPriority; label: string }[] = [
  { value: 1, label: "高" },
  { value: 2, label: "中" },
  { value: 3, label: "低" },
];

const RELATION_STATUS_OPTIONS: { value: RelationStatus; label: string }[] = [
  { value: "lead", label: "見込み" },
  { value: "active", label: "対応中" },
  { value: "advisor", label: "顧問中" },
  { value: "ended", label: "対応終了" },
];

const LOG_CHANNEL_OPTIONS: { value: PatientLogChannel; label: string }[] = [
  { value: "call", label: "電話" },
  { value: "online", label: "オンライン" },
  { value: "visit", label: "来局・対面" },
  { value: "message", label: "メッセージ" },
  { value: "other", label: "その他" },
];

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

export default function PrmPatientDetailPage() {
  const router = useRouter();
  const params = useParams<{ patientId?: string | string[] }>();

  const patientId =
    typeof params.patientId === "string"
      ? params.patientId
      : Array.isArray(params.patientId)
      ? params.patientId[0]
      : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientWithRelations | null>(null);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);

  // 相談ログ
  const [logs, setLogs] = useState<PatientLog[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  // 編集用 state（PRM）
  const [relationStatus, setRelationStatus] = useState<RelationStatus>("lead");
  const [priority, setPriority] = useState<PrmPriority>(2);
  const [mainPharmacistId, setMainPharmacistId] = useState<string>("");
  const [nextContactDate, setNextContactDate] = useState<string>("");
  const [lastContactDate, setLastContactDate] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // 新規相談ログ用 state
  const [newLogDate, setNewLogDate] = useState<string>(() =>
    toDateInputValue(new Date().toISOString()),
  );
  const [newLogChannel, setNewLogChannel] =
    useState<PatientLogChannel>("online");
  const [newLogSummary, setNewLogSummary] = useState<string>("");
  const [newLogNote, setNewLogNote] = useState<string>("");
  const [creatingLog, setCreatingLog] = useState(false);

  // 患者＋薬剤師＋ログを読み込み
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      if (!patientId) {
        setError("URL の患者IDが不正です。");
        setLoading(false);
        return;
      }

      try {
        // 患者
        const { data: patientRows, error: patientError } = await supabase
          .from("patients")
          .select("*")
          .eq("id", patientId)
          .limit(1);

        if (patientError) throw patientError;
        if (!patientRows || patientRows.length === 0) {
          throw new Error("患者データが見つかりませんでした。");
        }

        const row = patientRows[0] as any;

        // 薬局
        const { data: pharmacyRows, error: pharmacyError } = await supabase
          .from("pharmacies")
          .select("*");

        if (pharmacyError) throw pharmacyError;

        // 薬剤師
        const { data: pharmacistRows, error: pharmacistError } = await supabase
          .from("pharmacists")
          .select("*")
          .order("name", { ascending: true });

        if (pharmacistError) throw pharmacistError;

        const pharmacyMap = new Map<string, Pharmacy>();
        (pharmacyRows ?? []).forEach((p) => {
          if (p.id) pharmacyMap.set(p.id as string, p);
        });

        const pharmacistMap = new Map<string, Pharmacist>();
        (pharmacistRows ?? []).forEach((p) => {
          if (p.id) pharmacistMap.set(p.id as string, p);
        });

        const pharmacy =
          row.pharmacy_id && pharmacyMap.has(row.pharmacy_id)
            ? pharmacyMap.get(row.pharmacy_id)!
            : null;

        const main_pharmacist =
          row.main_pharmacist_id && pharmacistMap.has(row.main_pharmacist_id)
            ? pharmacistMap.get(row.main_pharmacist_id)!
            : null;

        const patientWithRelations: PatientWithRelations = {
          ...(row as PatientWithPrm),
          pharmacy_id: (row.pharmacy_id ?? null) as string | null,
          main_pharmacist_id: (row.main_pharmacist_id ?? null) as string | null,
          relation_status: (row.relation_status ?? "lead") as RelationStatus,
          next_contact_at: (row.next_contact_at ?? null) as string | null,
          last_contact_at: (row.last_contact_at ?? null) as string | null,
          priority: ((row.priority ?? 2) as unknown) as PrmPriority,
          tags: (row.tags ?? []) as string[],
          pharmacy,
          main_pharmacist,
        };

        setPatient(patientWithRelations);
        setPharmacists(pharmacistRows ?? []);

        // 編集 state 初期化
        setRelationStatus(patientWithRelations.relation_status);
        setPriority(patientWithRelations.priority);
        setMainPharmacistId(patientWithRelations.main_pharmacist_id ?? "");
        setNextContactDate(
          toDateInputValue(patientWithRelations.next_contact_at),
        );
        setLastContactDate(
          toDateInputValue(patientWithRelations.last_contact_at),
        );
        setTags(patientWithRelations.tags ?? []);
        setNote((row.note as string | null) ?? "");
      } catch (err: any) {
        console.error("Failed to fetch patient detail", err);
        setError(err.message ?? "データ取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    const fetchLogs = async () => {
      if (!patientId) return;
      setLogLoading(true);
      setLogError(null);
      try {
        const { data, error } = await supabase
          .from("patient_logs")
          .select("*")
          .eq("patient_id", patientId)
          .order("contact_at", { ascending: false });

        if (error) throw error;
        setLogs((data ?? []) as PatientLog[]);
      } catch (err: any) {
        console.error("Failed to fetch patient logs", err);
        setLogError(err.message ?? "相談ログの取得に失敗しました。");
      } finally {
        setLogLoading(false);
      }
    };

    fetchData();
    fetchLogs();
  }, [patientId]);

  const pharmacyName = useMemo(() => {
    if (!patient?.pharmacy) return "未割り当て";
    return ((patient.pharmacy as any).name as string) ?? "未割り当て";
  }, [patient]);

  const patientName = (patient as any)?.name ?? "（名称未設定）";
  const patientEmail = (patient as any)?.email ?? "";
  const patientLanguage = (patient as any)?.language ?? "-";
  const patientType = (patient as any)?.patient_type ?? "-";
  const careStyle = (patient as any)?.care_style ?? "-";

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!patient) return;
    setSaving(true);
    setError(null);

    try {
      const updatePayload = {
        relation_status: relationStatus,
        priority,
        main_pharmacist_id: mainPharmacistId === "" ? null : mainPharmacistId,
        next_contact_at: nextContactDate
          ? fromDateInputValue(nextContactDate)
          : null,
        last_contact_at: lastContactDate
          ? fromDateInputValue(lastContactDate)
          : null,
        tags,
        note,
      };

      const { error: updateError } = await supabase
        .from("patients")
        .update(updatePayload)
        .eq("id", patient.id);

      if (updateError) throw updateError;

      setPatient((prev) =>
        prev
          ? {
              ...prev,
              relation_status: relationStatus,
              priority,
              main_pharmacist_id:
                mainPharmacistId === "" ? null : mainPharmacistId,
              next_contact_at: updatePayload.next_contact_at,
              last_contact_at: updatePayload.last_contact_at,
              tags: [...tags],
            }
          : prev,
      );
    } catch (err: any) {
      console.error("Failed to save patient detail", err);
      setError(err.message ?? "保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLog = async () => {
    if (!patientId) return;
    if (!newLogSummary.trim()) {
      alert("一行要約を入力してください。");
      return;
    }

    setCreatingLog(true);
    setLogError(null);

    try {
      const contact_atIso = fromDateInputValue(newLogDate) ?? new Date().toISOString();

      const payload = {
        patient_id: patientId,
        contact_at: contact_atIso,
        channel: newLogChannel,
        summary: newLogSummary.trim(),
        note: newLogNote.trim() || null,
      };

      const { data, error } = await supabase
        .from("patient_logs")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      const inserted = data as PatientLog;

      // 先頭に追加（新しい順）
      setLogs((prev) => [inserted, ...prev]);

      // フォーム初期化（日時はそのままでもOKだが、要約・メモはクリア）
      setNewLogSummary("");
      setNewLogNote("");

      // 最終フォロー日を自動更新しておく（任意）
      setLastContactDate(toDateInputValue(inserted.contact_at));
    } catch (err: any) {
      console.error("Failed to create patient log", err);
      setLogError(err.message ?? "相談ログの登録に失敗しました。");
    } finally {
      setCreatingLog(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            患者詳細（PRM）
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            顧問候補・顧問中の患者ごとに、担当者・ステータス・フォロー予定日と相談ログを管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/prm/patients">
            <AppButton variant="outline" size="sm">
              一覧に戻る
            </AppButton>
          </Link>
        </div>
      </div>

      {loading ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          読み込み中です…
        </AppCard>
      ) : error ? (
        <AppCard className="space-y-3 border-red-200 bg-red-50/60">
          <div className="text-sm font-medium text-red-800">
            エラーが発生しました
          </div>
          <div className="text-xs text-red-700">{error}</div>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
          >
            再読み込み
          </AppButton>
        </AppCard>
      ) : !patient ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          患者データが見つかりませんでした。
        </AppCard>
      ) : (
        <>
          {/* 患者基本情報 */}
          <AppCard className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  患者情報
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {patientName}
                </div>
                {patientEmail && (
                  <div className="text-xs text-slate-500">{patientEmail}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-slate-700">
                  言語：{patientLanguage}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-slate-700">
                  顧問タイプ：{patientType}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-slate-700">
                  相談スタイル：{careStyle}
                </span>
              </div>
            </div>

            <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="font-medium text-slate-700">担当薬局</div>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {pharmacyName}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-slate-700">
                  作成日時 / 最終更新
                </div>
                <div className="rounded-md border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
                  <div>
                    作成：
                    {formatDateTime((patient as any).created_at ?? null)}
                  </div>
                  <div>
                    更新：
                    {formatDateTime((patient as any).updated_at ?? null)}
                  </div>
                </div>
              </div>
            </div>
          </AppCard>

          {/* PRM 編集ブロック */}
          <AppCard className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  関係ステータス・担当者
                </h2>
                <p className="text-xs text-slate-500">
                  顧問候補〜顧問中までのステータスと、メインの担当薬剤師を設定します。
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* ステータス */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  ステータス
                </label>
                <select
                  value={relationStatus}
                  onChange={(e) =>
                    setRelationStatus(e.target.value as RelationStatus)
                  }
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                >
                  {RELATION_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  「顧問中」になった患者は、薬局のKPIとしてもカウントしやすくなります。
                </p>
              </div>

              {/* 優先度 */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  優先度
                </label>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(Number(e.target.value) as PrmPriority)
                  }
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  フォローの優先度。高いものから順に一覧画面で確認しやすくなります。
                </p>
              </div>

              {/* メイン担当薬剤師 */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  メイン担当薬剤師
                </label>
                <select
                  value={mainPharmacistId}
                  onChange={(e) => setMainPharmacistId(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                >
                  <option value="">未設定</option>
                  {pharmacists.map((ph) => (
                    <option key={ph.id} value={ph.id as string}>
                      {(ph as any).name ?? "名称未設定"}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  顧問候補として継続的にフォローする薬剤師を設定します。
                </p>
              </div>
            </div>

            {/* フォロー日 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  次回フォロー予定日
                </label>
                <input
                  type="date"
                  value={nextContactDate}
                  onChange={(e) => setNextContactDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  「この日までに一度連絡を入れる」という目安日。PRM一覧の並び順にも使われます。
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  最終フォロー日
                </label>
                <input
                  type="date"
                  value={lastContactDate}
                  onChange={(e) => setLastContactDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  実際に最後にコンタクトした日付を記録します。
                </p>
              </div>
            </div>

            {/* タグ編集 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    タグ
                  </label>
                  <p className="text-[11px] text-slate-500">
                    例：在宅希望 / IBS / 家族相談 / 英語希望 など。自由にラベリングできます。
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {tags.length === 0 ? (
                  <span className="text-[11px] text-slate-400">
                    まだタグはありません。
                  </span>
                ) : (
                  tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-[11px] text-slate-500 hover:text-slate-800"
                        aria-label={`${tag} を削除`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="タグを入力して Enter で追加"
                  className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                />
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                >
                  タグ追加
                </AppButton>
              </div>
            </div>

            {/* メモ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    メモ（暫定）
                  </label>
                  <p className="text-[11px] text-slate-500">
                    相談内容や注意点の簡単なメモ。将来的には「相談ログ」のタイムラインに分離する想定です。
                  </p>
                </div>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="例：初回はIBSの腹痛・下痢が主訴。仕事のストレスが強く、夜間の不眠もあり。家族も一緒に相談したい希望あり。"
              />
            </div>

            {/* 保存ボタン */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              {saving && (
                <div className="text-xs text-slate-500">保存中です…</div>
              )}
              <AppButton
                type="button"
                variant="primary"
                size="md"
                disabled={saving}
                onClick={handleSave}
              >
                変更を保存
              </AppButton>
            </div>
          </AppCard>

          {/* 相談ログ一覧 + 追加フォーム */}
          <AppCard className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  相談ログ
                </h2>
                <p className="text-xs text-slate-500">
                  面談・電話・オンライン相談など、患者さんとのやりとりの履歴を記録します。
                </p>
              </div>
            </div>

            {/* 追加フォーム */}
            <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    日付
                  </label>
                  <input
                    type="date"
                    value={newLogDate}
                    onChange={(e) => setNewLogDate(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    チャネル
                  </label>
                  <select
                    value={newLogChannel}
                    onChange={(e) =>
                      setNewLogChannel(e.target.value as PatientLogChannel)
                    }
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  >
                    {LOG_CHANNEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    一行要約
                  </label>
                  <input
                    type="text"
                    value={newLogSummary}
                    onChange={(e) => setNewLogSummary(e.target.value)}
                    placeholder="例：IBS悪化で夜間の腹痛相談・仕事ストレス強い"
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  詳細メモ（任意）
                </label>
                <textarea
                  value={newLogNote}
                  onChange={(e) => setNewLogNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="面談で話した内容・薬の提案・今後のフォロー方針などをメモします。"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                {creatingLog && (
                  <div className="text-xs text-slate-500">
                    相談ログを登録中です…
                  </div>
                )}
                <AppButton
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={creatingLog}
                  onClick={handleCreateLog}
                >
                  相談ログを追加
                </AppButton>
              </div>

              {logError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {logError}
                </div>
              )}
            </div>

            {/* ログ一覧 */}
            {logLoading ? (
              <div className="py-4 text-xs text-slate-500">
                相談ログを読み込み中です…
              </div>
            ) : logs.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">
                まだ相談ログは登録されていません。
                初回面談や電話相談から記録していきましょう。
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const channelLabel =
                    LOG_CHANNEL_OPTIONS.find((c) => c.value === log.channel)
                      ?.label ?? "その他";

                  return (
                    <div
                      key={log.id}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {formatDate(log.contact_at)}
                          </span>
                          <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                            {channelLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          登録：
                          {formatDateTime(log.created_at)}
                        </div>
                      </div>
                      <div className="mt-1 text-[13px] font-medium text-slate-900">
                        {log.summary}
                      </div>
                      {log.note && (
                        <div className="mt-1 whitespace-pre-wrap text-[12px] text-slate-700">
                          {log.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </AppCard>
        </>
      )}
    </div>
  );
}
