// src/app/pharmacists/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import type {
  Pharmacist,
  Pharmacy,
  Patient,
  PatientType,
} from "@/types/supabase";
import { scorePharmacist } from "@/lib/matching/scorePharmacist";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { FavoriteButton } from "@/components/patient/FavoriteButton";
import {
  ArrowLeft,
  User,
  Hospital,
  MapPin,
  Calendar,
  MessageCircle,
  Globe2,
  Link2,
  AlertCircle,
  Loader2,
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
  { key: "second_opinion", label: "比較タイプ" },
];

// Supabase から取得する薬剤師の拡張型
type ExtendedPharmacist = Pharmacist & {
  visibility?: "public" | "members" | null;
  one_line_message?: string | null;
  short_message?: string | null;
  gender?: "" | "女性" | "男性" | "その他" | null;
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

type VisibilityType = "public" | "members" | "other";

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

export default function PharmacistDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const patientId = searchParams.get("patientId") ?? null;
  const pharmacistId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const [data, setData] = useState<PharmacistWithPharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 診断経由で開かれた場合の患者情報＆マッチング結果
  const [patient, setPatient] = useState<Patient | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchReasons, setMatchReasons] = useState<string[]>([]);

  useEffect(() => {
    if (!pharmacistId) {
      setError("薬剤師IDが指定されていません。");
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      setPatient(null);
      setMatchScore(null);
      setMatchReasons([]);

      try {
        // 1) 薬剤師本体
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

        // 2) 薬局（所属店舗）
        let pharmacy: Pharmacy | null = null;
        if (ph.belongs_pharmacy_id) {
          const { data: pm } = await supabase
            .from("pharmacies")
            .select("*")
            .eq("id", ph.belongs_pharmacy_id)
            .maybeSingle<Pharmacy>();
          pharmacy = pm ?? null;
        }

        setData({ pharmacist: ph, pharmacy });

        // 3) patientId があれば患者情報を取得してマッチングスコアを計算
        if (patientId) {
          const { data: p, error: pError } = await supabase
            .from("patients")
            .select("*")
            .eq("id", patientId)
            .maybeSingle<Patient>();

          if (!pError && p) {
            const effectiveType: PatientType =
              (p.type as PatientType | null) ?? ("A" as PatientType);

            setPatient(p);

            const { score, reasons } = scorePharmacist(
              p,
              effectiveType,
              ph,
              pharmacy
            );
            setMatchScore(score);
            setMatchReasons(reasons);
          } else {
            console.error(pError);
            setPatient(null);
            setMatchScore(null);
            setMatchReasons([]);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "薬剤師情報の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [pharmacistId, patientId]);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/pharmacists");
    }
  };

  const memoized = useMemo(() => {
    if (!data) return null;

    const { pharmacist, pharmacy } = data;

    const oneLineMessage =
      pharmacist.one_line_message ?? pharmacist.short_message ?? "";
    const visibilityRaw = pharmacist.visibility ?? "members";
    const visibility: VisibilityType =
      visibilityRaw === "public"
        ? "public"
        : visibilityRaw === "members"
        ? "members"
        : "other";

    const mainImageUrl = pharmacist.image_url ?? null;
    const subImages =
      (pharmacist.image_urls ?? []).filter((url) => url !== mainImageUrl) ?? [];

    const years = pharmacist.years_of_experience ?? null;
    const gender = pharmacist.gender ?? "";
    const genderOther = pharmacist.gender_other ?? "";
    const ageCategory = pharmacist.age_category ?? null;
    const licenseNumber = pharmacist.license_number ?? null;

    const languages = (pharmacist.language as string[] | null) ?? [];
    const specialties = (pharmacist.specialty as string[] | null) ?? [];
    const careRoles = (pharmacist.care_role as CareStyleKey[] | null) ?? [];
    const experiences =
      (pharmacist.experience_case as string[] | null) ?? [];

    const personality = pharmacist.personality ?? "";
    const consultationStyle = pharmacist.consultation_style ?? "";

    const webLinks = (pharmacist.web_links as string[] | null) ?? [];
    const snsLinks = (pharmacist.sns_links as string[] | null) ?? [];

    const bookingUrl = pharmacist.booking_url ?? null;
    const lineUrl = pharmacist.line_url ?? null;

    return {
      pharmacist,
      pharmacy,
      oneLineMessage,
      visibility,
      mainImageUrl,
      subImages,
      years,
      gender,
      genderOther,
      ageCategory,
      licenseNumber,
      languages,
      specialties,
      careRoles,
      experiences,
      personality,
      consultationStyle,
      webLinks,
      snsLinks,
      bookingUrl,
      lineUrl,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>薬剤師プロフィールを読み込んでいます...</span>
        </AppCard>
      </div>
    );
  }

  if (error || !memoized) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          薬剤師一覧に戻る
        </button>
        <AppCard className="space-y-2 border-red-200 bg-red-50/70">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800">
            <AlertCircle className="h-4 w-4" />
            プロフィールの表示中にエラーが発生しました
          </div>
          <div className="text-xs text-red-700">
            {error ?? "薬剤師プロフィールが見つかりませんでした。"}
          </div>
        </AppCard>
      </div>
    );
  }

  const {
    pharmacist,
    pharmacy,
    oneLineMessage,
    visibility,
    mainImageUrl,
    subImages,
    years,
    gender,
    genderOther,
    ageCategory,
    licenseNumber,
    languages,
    specialties,
    careRoles,
    experiences,
    personality,
    consultationStyle,
    webLinks,
    snsLinks,
    bookingUrl,
    lineUrl,
  } = memoized;

  const imageSrc = mainImageUrl ?? "/images/pharmacist-placeholder.png";
  const isExternalImage =
    imageSrc.startsWith("http://") || imageSrc.startsWith("https://");

  const introText = consultationStyle || personality;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* 戻るリンク */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {patientId ? "診断結果に戻る" : "薬剤師一覧に戻る"}
      </button>

      {/* ヘッダー + 基本情報 */}
      <AppCard className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        {/* 顔写真 */}
        <div className="flex-shrink-0">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-100 sm:h-28 sm:w-28">
            {isExternalImage ? (
              <img
                src={imageSrc}
                alt={`${pharmacist.name}の写真`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={imageSrc}
                alt={`${pharmacist.name}の写真`}
                width={112}
                height={112}
                className="h-full w-full object-cover"
              />
            )}
          </div>

          {subImages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {subImages.slice(0, 3).map((url) => (
                <div
                  key={url}
                  className="h-10 w-10 overflow-hidden rounded-md bg-slate-100"
                >
                  <img
                    src={url}
                    alt={`${pharmacist.name} サブ画像`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* テキスト情報 */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              {pharmacist.name ?? "（名称未設定）"}
            </h1>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              <User className="mr-1 h-3 w-3" />
              薬剤師
            </span>
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border",
                visibility === "public"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-slate-50 text-slate-700",
              ].join(" ")}
            >
              {visibility === "public" ? "一般公開" : "登録ユーザー限定"}
            </span>
          </div>

          {oneLineMessage && (
            <p className="text-sm text-slate-700">{oneLineMessage}</p>
          )}

          {/* 属性タグ */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {years != null && (
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200">
                経験 {years} 年
              </span>
            )}
            {gender && (
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200">
                性別:{" "}
                {gender === "その他" && genderOther
                  ? `その他（${genderOther}）`
                  : gender}
              </span>
            )}
            {ageCategory && (
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200">
                年代: {ageCategory}
              </span>
            )}
            {patient && matchScore != null && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 border border-sky-200">
                マッチング {matchScore} 点
              </span>
            )}
          </div>

          {/* 所属情報 */}
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <Hospital className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-800">所属：</span>
              <span>
                {pharmacy?.name ?? "（所属薬局は未公開または未登録）"}
              </span>
            </div>
            {pharmacy?.area && (
              <div className="flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="text-slate-700">{pharmacy.area}</span>
              </div>
            )}
          </div>

          {/* 上部右側：お気に入り & 戻るボタン */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <FavoriteButton pharmacistId={pharmacist.id} />
            <AppButton
              size="sm"
              variant="outline"
              onClick={() => {
                if (patientId) {
                  router.push(`/pharmacists?patientId=${patientId}`);
                } else {
                  router.push("/pharmacists");
                }
              }}
            >
              一覧にもどる
            </AppButton>
          </div>

          {/* 予約 / 連絡ボタン */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-2">
            {bookingUrl && (
              <AppButton
                size="sm"
                variant="primary"
                onClick={() =>
                  window.open(bookingUrl, "_blank", "noopener,noreferrer")
                }
              >
                <Calendar className="mr-1 h-4 w-4" />
                空き時間を予約する
              </AppButton>
            )}
            {lineUrl && (
              <button
                type="button"
                onClick={() =>
                  window.open(lineUrl, "_blank", "noopener,noreferrer")
                }
                className="inline-flex items-center justify-center rounded-md border border-[#06C755] bg-[#06C755] px-3 py-2 text-[11px] font-medium text-white hover:opacity-90"
              >
                <MessageCircle className="mr-1 h-4 w-4" />
                LINEで相談する
              </button>
            )}
          </div>
        </div>
      </AppCard>

      {/* 自己紹介・相談スタイル */}
      <AppCard className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          自己紹介・相談スタイル
        </h2>
        {introText ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {introText}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            自己紹介の文章はまだ登録されていません。
          </p>
        )}
      </AppCard>

      {/* タグエリア：得意な分野・患者タイプ・言語など */}
      <AppCard className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">
          得意な分野・対応できる患者さん
        </h2>

        {/* 言語 */}
        <div className="space-y-1 text-xs">
          <p className="font-medium text-slate-700">対応可能な言語</p>
          <div className="flex flex-wrap gap-1">
            {languages.length === 0 ? (
              <span className="text-[11px] text-slate-400">未設定</span>
            ) : (
              languages.map((l) => (
                <span
                  key={l}
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-100"
                >
                  {formatLanguageLabel(l)}
                </span>
              ))
            )}
          </div>
        </div>

        {/* 専門領域 */}
        <div className="space-y-1 text-xs">
          <p className="font-medium text-slate-700">得意な領域・症状</p>
          <div className="flex flex-wrap gap-1">
            {specialties.length === 0 ? (
              <span className="text-[11px] text-slate-400">未設定</span>
            ) : (
              specialties.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 border border-sky-100"
                >
                  {s}
                </span>
              ))
            )}
          </div>
        </div>

        {/* 得意な患者タイプ（care_role） */}
        <div className="space-y-1 text-xs">
          <p className="font-medium text-slate-700">
            得意な患者さんのタイプ
          </p>
          <div className="flex flex-wrap gap-1">
            {careRoles.length === 0 ? (
              <span className="text-[11px] text-slate-400">未設定</span>
            ) : (
              careRoles.map((c) => {
                const label =
                  CARE_STYLE_OPTIONS.find((o) => o.key === c)?.label ?? c;
                return (
                  <span
                    key={c}
                    className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-700 border border-orange-100"
                  >
                    {label}
                  </span>
                );
              })
            )}
          </div>
        </div>

        {/* 主な相談経験 */}
        <div className="space-y-1 text-xs">
          <p className="font-medium text-slate-700">主なご相談経験</p>
          {experiences.length === 0 ? (
            <span className="text-[11px] text-slate-400">未設定</span>
          ) : (
            <p className="text-[11px] text-slate-700">
              {experiences.join(" / ")}
            </p>
          )}
        </div>

        {/* 免許番号 */}
        {licenseNumber && (
          <div className="space-y-1 text-xs text-slate-600">
            <p className="font-medium text-slate-700">薬剤師免許番号</p>
            <p>{licenseNumber}</p>
          </div>
        )}
      </AppCard>

      {/* 診断結果に基づくマッチング情報 */}
      {patient && matchScore != null && (
        <AppCard className="space-y-2 border-sky-200 bg-sky-50/70">
          <p className="text-xs font-semibold text-sky-800">
            あなたの診断結果にもとづくマッチング評価
          </p>
          <p className="text-xs md:text-sm text-sky-900">
            この薬剤師さんは、あなたとのマッチングスコアが{" "}
            <span className="font-semibold">{matchScore} 点</span>
            でした。
          </p>
          {matchReasons.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-[11px] space-y-1 text-sky-900">
              {matchReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </AppCard>
      )}

      {/* Webリンク / SNSリンク */}
      {(webLinks.length > 0 || snsLinks.length > 0) && (
        <AppCard className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Webサイト・SNS
          </h2>
          <div className="space-y-2 text-xs">
            {webLinks.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-slate-700">Webサイト</p>
                <ul className="space-y-1">
                  {webLinks.map((url, idx) => (
                    <li key={url + idx}>
                      <button
                        type="button"
                        onClick={() =>
                          window.open(url, "_blank", "noopener,noreferrer")
                        }
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
                      >
                        <Globe2 className="h-3 w-3" />
                        <span className="underline underline-offset-2 break-all">
                          {url}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {snsLinks.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-slate-700">SNSアカウント</p>
                <ul className="space-y-1">
                  {snsLinks.map((url, idx) => (
                    <li key={url + idx}>
                      <button
                        type="button"
                        onClick={() =>
                          window.open(url, "_blank", "noopener,noreferrer")
                        }
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
                      >
                        <Link2 className="h-3 w-3" />
                        <span className="underline underline-offset-2 break-all">
                          {url}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AppCard>
      )}
    </div>
  );
}
