// src/app/pharmacists/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import type {
  Pharmacist,
  Pharmacy,
  Patient,
  PatientType,
} from "@/types/supabase";
import {
  scorePharmacist,
  type CareStyleKey,
} from "@/lib/matching/scorePharmacist";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { FavoriteButton } from "@/components/patient/FavoriteButton";

// Supabase pharmacists テーブルの拡張版
type ExtendedPharmacist = Pharmacist & {
  visibility?: "public" | "members" | null;
  one_line_message?: string | null;
  gender?: "" | "女性" | "男性" | "その他" | null;
  short_message?: string | null; 
  gender_other?: string | null;
  birth_date?: string | null;
  age_category?: "20代" | "30代" | "40代" | "50代" | "60代" | "70代以上" | null;
  license_number?: string | null;
  web_links?: string[] | null;
  sns_links?: string[] | null;
  image_urls?: string[] | null;
  image_url?: string | null;
  care_role?: CareStyleKey[] | null;
  booking_url?: string | null;
  line_url?: string | null; 
};

interface PharmacistWithPharmacy {
  pharmacist: ExtendedPharmacist;
  pharmacy: Pharmacy | null;
}

interface PharmacistWithScore extends PharmacistWithPharmacy {
  score: number | null;
}

// 経験年数フィルタ
type ExperienceFilter = "all" | "0-3" | "4-7" | "8plus";
// 年代フィルタ（age_category を前提にする）
type AgeCategoryFilter =
  | "all"
  | "20代"
  | "30代"
  | "40代"
  | "50代"
  | "60代"
  | "70代以上";

type VisibilityType = "public" | "members" | "other";

const CARE_STYLE_LABEL: Record<CareStyleKey, string> = {
  understanding: "しっかり理解タイプ",
  empathy: "気持ちケアタイプ",
  expert: "おまかせタイプ",
  support: "継続苦手タイプ",
  family: "家族サポートタイプ",
  second_opinion: "比較タイプ",
};

function formatLanguageLabel(code: string): string {
  switch (code) {
    case "ja":
      return "日本語";
    case "en":
      return "英語";
    case "zh":
      return "中国語";
    case "vi":
      return "ベトナム語";
    case "ko":
      return "韓国語";
    default:
      return code;
  }
}

// ★ ここからが実際のページ本体コンポーネント
function PharmacistsListPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get("patientId") ?? null;
  const [items, setItems] = useState<PharmacistWithPharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 診断経由の場合に使う患者情報
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientType, setPatientType] = useState<PatientType | null>(null);

  // 検索・フィルタ用の状態
  const [keyword, setKeyword] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [careStyleFilter, setCareStyleFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [experienceFilter, setExperienceFilter] =
    useState<ExperienceFilter>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [ageCategoryFilter, setAgeCategoryFilter] =
    useState<AgeCategoryFilter>("all");

  // 薬剤師 & 薬局の一覧取得 + 患者情報取得
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) patientId があれば患者情報取得
        let loadedPatient: Patient | null = null;
        let loadedType: PatientType | null = null;

        if (patientId) {
          const { data: p, error: pError } = await supabase
            .from("patients")
            .select("*")
            .eq("id", patientId)
            .single<Patient>();

          if (pError) {
            console.error(pError);
          } else if (p) {
            loadedPatient = p;
            loadedType = (p.type as PatientType | null) ?? ("A" as PatientType);
          }
        }

        setPatient(loadedPatient);
        setPatientType(loadedType);

        // 2) 薬剤師一覧
        const { data: pharmacistsData, error: phError } = await supabase
          .from("pharmacists")
          .select("*")
          .in("visibility", ["public", "members"]) // ログイン状況は public 側で制御
          .order("name", { ascending: true })
          .returns<ExtendedPharmacist[]>();

        if (phError) throw phError;

        // 3) 薬局一覧
        const { data: pharmaciesData, error: pmError } = await supabase
          .from("pharmacies")
          .select("*")
          .returns<Pharmacy[]>();

        if (pmError) throw pmError;

        const pharmacyMap = new Map<string, Pharmacy>();
        (pharmaciesData ?? []).forEach((p) => {
          pharmacyMap.set(p.id, p);
        });

        // 4) マージ（ここではスコア計算しない）
        const merged: PharmacistWithPharmacy[] = (pharmacistsData ?? []).map(
          (ph) => ({
            pharmacist: ph,
            pharmacy:
              ph.belongs_pharmacy_id && pharmacyMap.has(ph.belongs_pharmacy_id)
                ? pharmacyMap.get(ph.belongs_pharmacy_id)!
                : null,
          })
        );

        setItems(merged);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "薬剤師一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [patientId]);

  // 選択肢候補をデータから生成
  const filterOptions = useMemo(() => {
    const languageSet = new Set<string>();
    const specialtySet = new Set<string>();
    const careRoleSet = new Set<string>();
    const areaSet = new Set<string>();
    const genderSet = new Set<string>();
    const ageCategorySet = new Set<string>();

    items.forEach(({ pharmacist, pharmacy }) => {
      const languages = (pharmacist.language as string[] | null) ?? [];
      languages.forEach((l) => languageSet.add(l));

      const specialties = (pharmacist.specialty as string[] | null) ?? [];
      specialties.forEach((s) => specialtySet.add(s));

      const careRoles = (pharmacist.care_role as string[] | null) ?? [];
      careRoles.forEach((c) => careRoleSet.add(c));

      if (pharmacy?.area) {
        areaSet.add(pharmacy.area);
      }

      const gender = (pharmacist.gender as string | null) ?? null;
      if (gender) genderSet.add(gender);

      const ageCategory = (pharmacist.age_category as string | null) ?? null;
      if (ageCategory) ageCategorySet.add(ageCategory);
    });

    return {
      languages: Array.from(languageSet),
      specialties: Array.from(specialtySet),
      careRoles: Array.from(careRoleSet),
      areas: Array.from(areaSet),
      genders: Array.from(genderSet),
      ageCategories: Array.from(ageCategorySet),
    };
  }, [items]);

  // フィルタ・検索を適用した一覧 ＋ 相性スコア付与・ソート
  const filteredItemsWithScore: PharmacistWithScore[] = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    const base = items.filter(({ pharmacist, pharmacy }) => {
      const languages = (pharmacist.language as string[] | null) ?? [];
      const specialties = (pharmacist.specialty as string[] | null) ?? [];
      const careRoles = (pharmacist.care_role as string[] | null) ?? [];
      const experiences =
        (pharmacist.experience_case as string[] | null) ?? [];

      const years = pharmacist.years_of_experience ?? null;
      const gender = (pharmacist.gender as string | null) ?? null;
      const ageCategory =
        (pharmacist.age_category as string | null) ?? null;

      // キーワード検索（名前・薬局名・専門・言語・経験・一言メッセージなど）
      if (kw) {
        const oneLine =
          pharmacist.one_line_message ?? pharmacist.short_message ?? "";
        const profile =
          (pharmacist as any).profile_message ??
          pharmacist.consultation_style ??
          "";

        const textBucket = [
          pharmacist.name ?? "",
          pharmacy?.name ?? "",
          oneLine,
          profile,
          specialties.join(" "),
          languages.join(" "),
          experiences.join(" "),
          pharmacy?.area ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!textBucket.includes(kw)) return false;
      }

      // 言語フィルタ
      if (languageFilter !== "all") {
        if (!languages.includes(languageFilter)) return false;
      }

      // 専門領域フィルタ
      if (specialtyFilter !== "all") {
        if (!specialties.includes(specialtyFilter)) return false;
      }

      // 相談スタイルフィルタ（care_role）
      if (careStyleFilter !== "all") {
        if (!careRoles.includes(careStyleFilter)) return false;
      }

      // エリアフィルタ
      if (areaFilter !== "all") {
        if (!pharmacy?.area || pharmacy.area !== areaFilter) return false;
      }

      // 経験年数フィルタ
      if (experienceFilter !== "all") {
        if (years == null) return false;
        if (experienceFilter === "0-3" && !(years <= 3)) return false;
        if (experienceFilter === "4-7" && !(years >= 4 && years <= 7))
          return false;
        if (experienceFilter === "8plus" && !(years >= 8)) return false;
      }

      // 性別フィルタ
      if (genderFilter !== "all") {
        if (!gender || gender !== genderFilter) return false;
      }

      // 年代フィルタ（age_category）
      if (ageCategoryFilter !== "all") {
        if (!ageCategory || ageCategory !== ageCategoryFilter) return false;
      }

      return true;
    });

    // 患者情報がない場合はスコアなしでそのまま返す
    if (!patient || !patientType) {
      return base.map(({ pharmacist, pharmacy }) => ({
        pharmacist,
        pharmacy,
        score: null,
      }));
    }

    // 患者情報がある場合はスコアを計算してソート
    const withScore = base.map(({ pharmacist, pharmacy }) => {
      const { score } = scorePharmacist(
        patient,
        patientType,
        pharmacist,
        pharmacy
      );
      return { pharmacist, pharmacy, score };
    });

    return withScore.sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });
  }, [
    items,
    keyword,
    languageFilter,
    specialtyFilter,
    careStyleFilter,
    areaFilter,
    experienceFilter,
    genderFilter,
    ageCategoryFilter,
    patient,
    patientType,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            薬剤師一覧
          </h1>
          <p className="text-xs text-slate-600">
            専門領域・相談スタイル・言語などから、あなたに合いそうな薬剤師を探せます。
            {patient &&
              "（診断結果に基づいて、相性の良さ順に並べています）"}
          </p>
        </div>

        <div className="flex gap-2">
          {/* 診断のやり直し */}
          <AppButton
            size="sm"
            variant="outline"
            onClick={() => router.push("/diagnosis")}
          >
            顧問薬剤師診断をやり直す
          </AppButton>

          {/* 気になる薬剤師一覧へ */}
          <AppButton
            size="sm"
            variant="primary"
            onClick={() => router.push("/favorites")}
          >
            気になる薬剤師一覧
          </AppButton>
        </div>
      </div>

      {/* 検索 & フィルタブロック（スマホ優先） */}
      <AppCard className="space-y-3 p-4">
        {/* 上段：キーワード検索 + 件数表示 */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-slate-700">
              キーワードで探す
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="薬剤師名・薬局名・専門領域・エリア など"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="mt-2 text-right text-[11px] text-slate-500 md:mt-0 md:ml-4">
            該当件数：{filteredItemsWithScore.length} 名 / 全 {items.length} 名
          </div>
        </div>

        {/* 下段：フィルタ群（折り返しレイアウト） */}
        <div className="grid gap-3 text-[11px] md:grid-cols-2 lg:grid-cols-3">
          {/* 言語 */}
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">言語</p>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              {filterOptions.languages.map((l) => (
                <option key={l} value={l}>
                  {formatLanguageLabel(l)}
                </option>
              ))}
            </select>
          </div>

          {/* 専門領域 */}
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">専門領域</p>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              {filterOptions.specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 相談スタイル */}
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">相談スタイル</p>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={careStyleFilter}
              onChange={(e) => setCareStyleFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              {filterOptions.careRoles.map((c) => {
                const label =
                  CARE_STYLE_LABEL[c as CareStyleKey] ?? (c as string);
                return (
                  <option key={c} value={c}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* エリア */}
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">エリア</p>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              {filterOptions.areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* 経験年数 */}
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">経験年数</p>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={experienceFilter}
              onChange={(e) =>
                setExperienceFilter(e.target.value as ExperienceFilter)
              }
            >
              <option value="all">指定なし</option>
              <option value="0-3">〜3年</option>
              <option value="4-7">4〜7年</option>
              <option value="8plus">8年以上</option>
            </select>
          </div>

          {/* 性別 */}
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">性別</p>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              {filterOptions.genders.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* 年代（age_category） */}
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">年代</p>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={ageCategoryFilter}
              onChange={(e) =>
                setAgeCategoryFilter(e.target.value as AgeCategoryFilter)
              }
            >
              <option value="all">指定なし</option>
              {["20代", "30代", "40代", "50代", "60代", "70代以上"].map(
                (ac) => (
                  <option key={ac} value={ac}>
                    {ac}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </AppCard>

      {/* 一覧グリッド */}
      {loading ? (
        <div className="text-sm text-slate-600">読み込み中です...</div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : filteredItemsWithScore.length === 0 ? (
        <div className="text-sm text-slate-600">
          条件に合致する薬剤師がまだ登録されていません。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItemsWithScore.map(({ pharmacist, pharmacy, score }) => {
            const oneLine =
              pharmacist.one_line_message ?? pharmacist.short_message ?? "";
            const visibilityRaw = pharmacist.visibility ?? "members";
            const visibility: VisibilityType =
              visibilityRaw === "public"
                ? "public"
                : visibilityRaw === "members"
                ? "members"
                : "other";

            const years = pharmacist.years_of_experience ?? null;
            const gender = pharmacist.gender ?? null;
            const genderOther = pharmacist.gender_other ?? "";
            const ageCategory = pharmacist.age_category ?? null;

            // 画像URL
            const rawImageUrl = pharmacist.image_url ?? null;
            const displayImageSrc =
              rawImageUrl || "/images/pharmacist-placeholder.png";
            const isExternalImage =
              displayImageSrc.startsWith("http://") ||
              displayImageSrc.startsWith("https://");

            const languages = (pharmacist.language as string[] | null) ?? [];
            const specialties =
              (pharmacist.specialty as string[] | null) ?? [];
            const careRoles =
              (pharmacist.care_role as CareStyleKey[] | null) ?? [];
            const experiences =
              (pharmacist.experience_case as string[] | null) ?? [];

            const bookingUrl = pharmacist.booking_url ?? null;
            const lineUrl = pharmacist.line_url ?? null;

            const handleDetailClick = () => {
              const base = `/pharmacists/${pharmacist.id}`;
              if (patientId) {
                router.push(`${base}?patientId=${patientId}`);
              } else {
                router.push(base);
              }
            };

            const careRoleLabels = careRoles.map((c) => {
              const k = c as CareStyleKey;
              return CARE_STYLE_LABEL[k] ?? k;
            });

            return (
              <AppCard
                key={pharmacist.id}
                className="flex flex-col p-3 sm:p-4 shadow-sm"
              >
                {/* 上部：顔写真アイコン＋名前＋可視性＋お気に入り */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {/* 顔写真アイコン（丸） */}
                    <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100 flex-shrink-0">
                      {isExternalImage ? (
                        <img
                          src={displayImageSrc}
                          alt={`${pharmacist.name}の写真`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image
                          src={displayImageSrc}
                          alt={`${pharmacist.name}の写真`}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    {/* 名前・薬局名など */}
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">
                        {pharmacist.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                        {pharmacy?.name && <span>{pharmacy.name}</span>}
                        {pharmacy?.area && (
                          <span className="rounded-full border border-slate-200 px-1.5 py-0.5">
                            {pharmacy.area}
                          </span>
                        )}
                      </div>
                      {oneLine && (
                        <p className="text-[11px] text-slate-700">
                          {oneLine.length > 40
                            ? `${oneLine.slice(0, 40)}…`
                            : oneLine}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {/* visibility バッジ */}
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] border",
                        visibility === "public"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-slate-50 text-slate-700",
                      ].join(" ")}
                    >
                      {visibility === "public"
                        ? "一般公開"
                        : "登録ユーザー限定"}
                    </span>
                    <FavoriteButton pharmacistId={pharmacist.id} />
                  </div>
                </div>

                {/* 真ん中：タグ類 */}
                <div className="mb-2 space-y-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1">
                    {years != null && (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-200">
                        経験 {years} 年
                      </span>
                    )}
                    {gender && (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-200">
                        性別:{" "}
                        {gender === "その他" && genderOther
                          ? `その他（${genderOther}）`
                          : gender}
                      </span>
                    )}
                    {ageCategory && (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-200">
                        年代: {ageCategory}
                      </span>
                    )}
                    {/* 診断経由で patient があるときだけスコア表示 */}
                    {patient && score != null && (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-200">
                        マッチング {score} 点
                      </span>
                    )}
                  </div>

                  {/* 専門領域 */}
                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {specialties.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 言語 */}
                  {languages.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {languages.map((l) => (
                        <span
                          key={l}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 border border-emerald-100"
                        >
                          {formatLanguageLabel(l)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 相談スタイル（care_role） */}
                  {careRoleLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {careRoleLabels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700 border border-orange-100"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 主な相談経験 */}
                  {experiences.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[10px]">
                        主なご相談経験：
                      </span>
                      <span className="text-slate-700 text-[11px]">
                        {experiences.join(" / ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* 下部：ボタン群（スマホ優先で縦並び） */}
                <div className="mt-auto pt-2 border-t border-slate-200 space-y-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <AppButton
                      size="sm"
                      variant="primary"
                      className="w-full sm:w-auto"
                      onClick={handleDetailClick}
                    >
                      詳細を見る
                    </AppButton>

                    <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                      {bookingUrl && (
                        <AppButton
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto text-[11px]"
                          onClick={() =>
                            window.open(
                              bookingUrl,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          空き時間を予約
                        </AppButton>
                      )}
                      {lineUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              lineUrl,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="w-full rounded-md border border-[#06C755] bg-[#06C755] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 sm:w-auto"
                        >
                          LINEで相談
                        </button>
                      )}
                    </div>
                  </div>

                  {visibility === "members" && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      ※ このプロフィールの一部情報は、将来的に登録ユーザー限定で表示予定です。
                    </p>
                  )}
                </div>
              </AppCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ★ ここが Suspense でラップするためのエクスポート
export default function PharmacistsListPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-600">
          薬剤師一覧を読み込んでいます...
        </div>
      }
    >
      <PharmacistsListPageInner />
    </Suspense>
  );
}
