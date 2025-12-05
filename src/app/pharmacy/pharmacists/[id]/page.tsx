// src/app/pharmacy/pharmacists/[id]/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { getPharmacyCompanyIdForUser } from "@/lib/pharmacy-company";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import type { Pharmacist } from "@/types/supabase";
import {
  Loader2,
  AlertCircle,
  UserCircle2,
  Hospital,
  Save,
  ArrowLeft,
} from "lucide-react";

type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

const CARE_STYLE_OPTIONS: { key: CareStyleKey; label: string }[] = [
  { key: "understanding", label: "しっかり理解タイプ" },
  { key: "empathy", label: "気持ちケアタイプ" },
  { key: "expert", label: "おまかせタイプ" },
  { key: "support", label: "継続苦手タイプ" },
  { key: "family", label: "家族サポートタイプ" },
  { key: "second_opinion", label: "選択肢比較タイプ" },
];

// stores テーブル用の簡易型
type Store = {
  id: string;
  pharmacy_id: string | null;
  name: string | null;
  area: string | null;
};

type ExtendedPharmacist = Pharmacist & {
  visibility?: "public" | "members" | null;
  access_scope?: "public" | "registered_only" | null;
  language?: string[] | null;
  specialty?: string[] | null;
  care_role?: string[] | null;
  experience_case?: string[] | null;
  years_of_experience?: number | null;
  short_message?: string | null;
  personality?: string | null;
  consultation_style?: string | null;
  booking_url?: string | null;
  line_url?: string | null;
  image_url?: string | null;
  belongs_store_id?: string | null;
};

interface FormState {
  name: string;
  belongs_store_id: string;
  visibility: "public" | "members";
  access_scope: "public" | "registered_only";
  short_message: string;
  languagesText: string;
  specialtiesText: string;
  experiencesText: string;
  years_of_experience: string;
  personality: string;
  consultation_style: string;
  booking_url: string;
  line_url: string;
  image_url: string;
  careRolesSelected: CareStyleKey[];
}

export default function PharmacyPharmacistEditPage() {
  const params = useParams<{ id: string }>();
  const pharmacistId = params?.id as string | undefined;
  const router = useRouter();
  const {
    user,
    isPharmacyCompany,
    isAdmin,
    loading: authLoading,
    isAuthenticated,
    role,
  } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [pharmacist, setPharmacist] = useState<ExtendedPharmacist | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState<FormState | null>(null);

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

  const updateForm = (patch: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // データ取得（薬剤師 + その法人の stores）
  useEffect(() => {
    if (!pharmacistId) {
      setError("薬剤師IDが指定されていません。");
      setLoading(false);
      return;
    }

    // user がまだ取れていない状態では wait（admin は user 未取得でもOK）
    if (!user && !isAdmin) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      setSaveMessage(null);

      try {
        // 1) 薬剤師レコード
        const { data: ph, error: phError } = await supabase
          .from("pharmacists")
          .select("*")
          .eq("id", pharmacistId)
          .maybeSingle<ExtendedPharmacist>();

        if (phError) throw phError;
        if (!ph) {
          setError("指定された薬剤師が見つかりませんでした。");
          setLoading(false);
          return;
        }

        // 2) ログイン中ユーザーに紐づく pharmacy_company_id
        let ownedPharmacyId: string | null = null;
        if (isPharmacyCompany && user) {
          ownedPharmacyId = await getPharmacyCompanyIdForUser(
            supabase,
            user.id
          );

          if (!ownedPharmacyId) {
            setError(
              "このユーザーに紐づく薬局法人IDが設定されていません。先に薬局情報を設定してください。"
            );
            setLoading(false);
            return;
          }
        }

        // 3) stores 一覧（法人ユーザー → 自社のみ / admin → 全店舗）
        let storesQuery = supabase
          .from("stores")
          .select("*")
          .order("name", { ascending: true });

        if (ownedPharmacyId && !isAdmin) {
          storesQuery = storesQuery.eq("pharmacy_id", ownedPharmacyId);
        }

        const { data: storesData, error: storesError } =
          await storesQuery.returns<Store[]>();

        if (storesError) throw storesError;

        setPharmacist(ph);
        setStores(storesData ?? []);

        const languages = (ph.language ?? []) as string[];
        const specialties = (ph.specialty ?? []) as string[];
        const experiences = (ph.experience_case ?? []) as string[];

        const vis = (ph.visibility as "public" | "members" | null) ?? "members";
        const access =
          (ph.access_scope as "public" | "registered_only" | null) ?? "public";

        const years =
          ph.years_of_experience != null ? String(ph.years_of_experience) : "";

        // care_role を固定キーにマッピング
        const careRaw = (ph.care_role ?? []) as string[];
        const allowedKeys = new Set<CareStyleKey>(
          CARE_STYLE_OPTIONS.map((o) => o.key)
        );
        const careSelected = careRaw.filter((v): v is CareStyleKey =>
          allowedKeys.has(v as CareStyleKey)
        );

        // 所属店舗ID：優先順
        // 1) belongs_store_id があればそれを使う
        // 2) なければ、stores の中で id === ph.belongs_pharmacy_id のものがあればそれを使う
        // 3) それも無ければ空文字
        const initialStoreId: string =
          ph.belongs_store_id ??
          (storesData?.find((s) => s.id === ph.belongs_pharmacy_id)?.id ??
            "");

        const initialForm: FormState = {
          name: ph.name ?? "",
          belongs_store_id: initialStoreId,
          visibility: vis,
          access_scope: access,
          short_message: ph.short_message ?? "",
          languagesText: languages.join(", "),
          specialtiesText: specialties.join(", "),
          experiencesText: experiences.join(", "),
          years_of_experience: years,
          personality: ph.personality ?? "",
          consultation_style: ph.consultation_style ?? "",
          booking_url: ph.booking_url ?? "",
          line_url: ph.line_url ?? "",
          image_url: ph.image_url ?? "",
          careRolesSelected: careSelected,
        };

        setForm(initialForm);
      } catch (e: any) {
        console.error("[pharmacy/pharmacists/[id]] fetch error", e);
        setError(e.message ?? "薬剤師情報の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [pharmacistId, user, isPharmacyCompany, isAdmin]);

  const currentStore = useMemo(() => {
    if (!form?.belongs_store_id) return null;
    return stores.find((s) => s.id === form.belongs_store_id) ?? null;
  }, [form?.belongs_store_id, stores]);

  const parseList = (text: string): string[] | null => {
    const arr = text
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    return arr.length > 0 ? arr : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !pharmacistId) return;

    setError(null);
    setSaveMessage(null);

    // バリデーション：薬剤師名必須
    if (!form.name.trim()) {
      setError("薬剤師名は必須です。");
      return;
    }

    // バリデーション：所属店舗必須
    if (!form.belongs_store_id) {
      setError("所属店舗を選択してください。");
      return;
    }

    try {
      const yearsNum = form.years_of_experience.trim()
        ? Number(form.years_of_experience.trim())
        : null;

      if (
        yearsNum != null &&
        (Number.isNaN(yearsNum) || yearsNum < 0 || yearsNum > 80)
      ) {
        throw new Error("経験年数は 0〜80 年の範囲で入力してください。");
      }

      // 方針：belongs_pharmacy_id には店舗ID（stores.id）を保存する
      const belongsPharmacyId: string | null =
        form.belongs_store_id || null;

      const updatePayload: Partial<ExtendedPharmacist> = {
        name: form.name || null,
        // ★方針：belongs_pharmacy_id には店舗ID（stores.id）を保存する
        belongs_pharmacy_id: belongsPharmacyId,
        // ★互換用：belongs_store_id にも同じ店舗IDを保持
        belongs_store_id: form.belongs_store_id || null,
        visibility: form.visibility,
        access_scope: form.access_scope,
        short_message: form.short_message || null,
        language: parseList(form.languagesText),
        specialty: parseList(form.specialtiesText),
        experience_case: parseList(form.experiencesText),
        years_of_experience: yearsNum,
        personality: form.personality || null,
        consultation_style: form.consultation_style || null,
        booking_url: form.booking_url || null,
        line_url: form.line_url || null,
        image_url: form.image_url || null,
        care_role:
          form.careRolesSelected.length > 0
            ? form.careRolesSelected
            : null,
      };

      setSaving(true);

      const { error: updateError } = await supabase
        .from("pharmacists")
        .update(updatePayload)
        .eq("id", pharmacistId);

      if (updateError) throw updateError;

      setSaveMessage("保存しました。");
    } catch (e: any) {
      console.error("[pharmacy/pharmacists/[id]] update error", e);
      setError(e.message ?? "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading || !form) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>薬剤師情報を読み込んでいます...</span>
        </AppCard>
      </div>
    );
  }

  if (!isAuthenticated || (role !== "pharmacy_company" && role !== "admin")) {
    return null;
  }

  if (error && !pharmacist) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
        <AppCard className="space-y-2 border-red-200 bg-red-50/80">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800">
            <AlertCircle className="h-4 w-4" />
            エラーが発生しました
          </div>
          <p className="text-xs text-red-700">{error}</p>
        </AppCard>
        <AppButton
          size="sm"
          variant="outline"
          onClick={() => router.push("/pharmacy/pharmacists")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          薬剤師一覧にもどる
        </AppButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-7 w-7 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              薬剤師プロフィール編集
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              患者さんに表示されるプロフィール情報と、法人内の管理用情報を編集します。
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <AppButton
            size="sm"
            variant="outline"
            onClick={() => router.push("/pharmacy/pharmacists")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            一覧にもどる
          </AppButton>
        </div>
      </div>

      {/* エラー・保存メッセージ */}
      {error && (
        <AppCard className="space-y-1 border-red-200 bg-red-50/80 text-xs text-red-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            保存エラー
          </div>
          <p>{error}</p>
        </AppCard>
      )}
      {saveMessage && (
        <AppCard className="border-emerald-200 bg-emerald-50/70 text-xs text-emerald-800">
          {saveMessage}
        </AppCard>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <AppCard className="space-y-4 p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* 画像プレビュー */}
            <div className="w-full max-w-[160px]">
              <div className="mb-2 text-xs font-medium text-slate-700">
                メイン画像URL
              </div>
              <div className="mb-2 h-32 w-32 overflow-hidden rounded-lg bg-slate-100">
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt={form.name || "薬剤師画像"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">
                    画像なし
                  </div>
                )}
              </div>
              <input
                type="text"
                value={form.image_url}
                onChange={(e) => updateForm({ image_url: e.target.value })}
                placeholder="https://...（任意）"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                画像URLがある場合は、プロフィールや一覧に表示されます。
              </p>
            </div>

            {/* 基本情報フィールド */}
            <div className="flex-1 space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-700">
                  薬剤師名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：山田 花子"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">
                  所属店舗 <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex flex-col gap-1">
                  <select
                    value={form.belongs_store_id}
                    onChange={(e) =>
                      updateForm({ belongs_store_id: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  >
                    <option value="">店舗を選択してください</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name ?? "名称未設定"}
                        {s.area ? `（${s.area}）` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    店舗がない場合は、本部や拠点などを「店舗」として登録してください。
                  </p>
                  {currentStore && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
                      <Hospital className="h-3 w-3 text-slate-400" />
                      <span>{currentStore.name}</span>
                      {currentStore.area && (
                        <span className="text-slate-400">
                          （{currentStore.area}）
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-700">
                    公開範囲（プロフィール）
                  </label>
                  <select
                    value={form.visibility}
                    onChange={(e) =>
                      updateForm({
                        visibility: e.target.value as FormState["visibility"],
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  >
                    <option value="public">一般公開</option>
                    <option value="members">登録ユーザー限定</option>
                  </select>
                  <p className="mt-1 text-[10px] text-slate-500">
                    「登録ユーザー限定」は、将来的にログイン状況に応じた制御を行います。
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">
                    所属情報の公開範囲
                  </label>
                  <select
                    value={form.access_scope}
                    onChange={(e) =>
                      updateForm({
                        access_scope: e.target
                          .value as FormState["access_scope"],
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  >
                    <option value="public">誰でも閲覧可</option>
                    <option value="registered_only">
                      登録ユーザーのみ（所属情報を非公開）
                    </option>
                  </select>
                  <p className="mt-1 text-[10px] text-slate-500">
                    所属法人・店舗名をどこまで表示するかのポリシーとして利用できます。
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">
                  一言メッセージ
                </label>
                <input
                  type="text"
                  value={form.short_message}
                  onChange={(e) =>
                    updateForm({ short_message: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：がん治療中の方の副作用ケアを中心にサポートしています。"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  一覧やプロフィールの冒頭に表示される短い紹介文です（40〜60文字程度推奨）。
                </p>
              </div>
            </div>
          </div>
        </AppCard>

        {/* タグ系（言語・専門・スタイル・経験） */}
        <AppCard className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            得意分野・対応領域
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-700">
                対応言語（カンマ区切り）
              </label>
              <input
                type="text"
                value={form.languagesText}
                onChange={(e) => updateForm({ languagesText: e.target.value })}
                placeholder="例：ja, en, zh"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                システム上はコード（ja / en / zh / vi / ko）で管理しますが、運用上は日本語表記に統一しても構いません。
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                専門領域（カンマ区切り）
              </label>
              <input
                type="text"
                value={form.specialtiesText}
                onChange={(e) =>
                  updateForm({ specialtiesText: e.target.value })
                }
                placeholder="例：がん領域, 緩和ケア, 皮膚疾患"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* 得意な相談スタイル：固定キーの複数選択 */}
            <div>
              <label className="text-xs font-medium text-slate-700">
                得意な相談スタイル（複数選択可）
              </label>
              <select
                multiple
                value={form.careRolesSelected}
                onChange={(e) => {
                  const selected = Array.from(
                    e.currentTarget.selectedOptions
                  ).map((opt) => opt.value as CareStyleKey);
                  updateForm({ careRolesSelected: selected });
                }}
                className="mt-1 h-28 w-full rounded-md border border-slate-300 bg白 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              >
                {CARE_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                顧問薬剤師診断の結果と紐付けるための固定パターンです。
                Windowsなら Ctrl+クリック、Macなら ⌘+クリック で複数選択できます。
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                主な相談経験（カンマ区切り）
              </label>
              <input
                type="text"
                value={form.experiencesText}
                onChange={(e) =>
                  updateForm({ experiencesText: e.target.value })
                }
                placeholder="例：抗がん剤の副作用, 睡眠薬の減薬, IBS のセルフケア"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-700">
                経験年数
              </label>
              <input
                type="number"
                min={0}
                max={80}
                value={form.years_of_experience}
                onChange={(e) =>
                  updateForm({ years_of_experience: e.target.value })
                }
                placeholder="例：10"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
          </div>
        </AppCard>

        {/* 自己紹介・相談スタイル */}
        <AppCard className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            自己紹介・相談スタイル
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700">
                自己紹介・人柄（患者向け）
              </label>
              <textarea
                value={form.personality}
                onChange={(e) => updateForm({ personality: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="例：がん領域の薬剤師として10年以上、外来と在宅の両方で患者さんのサポートをしてきました。話しやすい雰囲気づくりを心がけています。"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                患者さんが人柄や相談しやすさをイメージできる内容を自由に記載してください。
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                相談の進め方・大事にしていること
              </label>
              <textarea
                value={form.consultation_style}
                onChange={(e) =>
                  updateForm({ consultation_style: e.target.value })
                }
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="例：負担にならない範囲で、少しずつお薬や生活習慣を見直していくスタイルです。まずは今の不安をしっかりお聞きするところから始めます。"
              />
            </div>
          </div>
        </AppCard>

        {/* 予約・連絡手段 */}
        <AppCard className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            予約方法・連絡手段
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-700">
                予約URL（オンライン予約）
              </label>
              <input
                type="text"
                value={form.booking_url}
                onChange={(e) => updateForm({ booking_url: e.target.value })}
                placeholder="https://...（Googleカレンダー、予約サイトなど）"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                設定すると、患者向けプロフィールから「空き時間を予約」ボタンで遷移します。
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                LINE公式アカウント URL
              </label>
              <input
                type="text"
                value={form.line_url}
                onChange={(e) => updateForm({ line_url: e.target.value })}
                placeholder="https://line.me/R/..."
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                設定すると、「LINEで相談」ボタンが表示されます。
              </p>
            </div>
          </div>
        </AppCard>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <AppButton type="submit" size="sm" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-1 h-4 w-4" />
                保存する
              </>
            )}
          </AppButton>
        </div>
      </form>
    </div>
  );
}
