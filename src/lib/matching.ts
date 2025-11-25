// src/lib/matching.ts
import type {
  Patient,
  Pharmacist,
  Pharmacy,
  PatientType,
} from "@/types/supabase";

// /diagnosis /result /pharmacists で揃えて使う相談スタイルキー
export type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

/**
 * 相談スタイルのラベル（スコア内のメッセージ用）
 */
const CARE_STYLE_LABEL_MAP: Record<CareStyleKey, string> = {
  understanding: "しっかり理解タイプ",
  empathy: "気持ちケアタイプ",
  expert: "おまかせタイプ",
  support: "継続苦手タイプ",
  family: "家族サポートタイプ",
  second_opinion: "比較タイプ",
};

/**
 * 患者・タイプ（A〜D）・薬剤師・薬局からマッチングスコアを算出
 * - /result と同じロジック
 * - 0〜100 点で返す
 */
export function scorePharmacist(
  patient: Patient,
  type: PatientType,
  pharmacist: Pharmacist,
  pharmacy: Pharmacy | null
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const specialties = pharmacist.specialty ?? [];
  const languages = pharmacist.language ?? [];
  const experiences = pharmacist.experience_case ?? [];

  // pharmacy.services は text[] / text / null の可能性があるので安全に配列化
  const rawServices = pharmacy?.services as unknown;
  const services: string[] = Array.isArray(rawServices)
    ? (rawServices as string[])
    : typeof rawServices === "string"
    ? rawServices
        .split(/[、,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const patientLanguage = patient.language ?? "ja";
  const valuePref = patient.value_preference ?? "";
  const severity = patient.severity ?? "";
  const area = patient.area ?? "";
  const symptomScore =
    (patient.symptom_score as Record<string, number> | null) ?? {};
  const lifestyleScore =
    (patient.lifestyle_score as Record<string, number> | null) ?? {};

  // 相談スタイル（care_style）と薬剤師側のテキスト情報
  const careStyle = (patient.care_style as CareStyleKey | null) ?? null;
  const styleText = (pharmacist.consultation_style ?? "") as string;
  const personality = (pharmacist.personality ?? "") as string;
  const years = pharmacist.years_of_experience ?? 0;

  // 薬剤師が登録している「得意な相談スタイル」の配列
  const careRoles = (pharmacist.care_role as string[] | null) ?? [];

  /* --- 1. 言語マッチ（最重要） --- */
  if (languages.includes(patientLanguage)) {
    score += 40;
    reasons.push("希望する言語で相談できる薬剤師です。");

    // Dタイプ（外国語重視）の場合はさらに加点
    if (type === "D") {
      score += 10;
      reasons.push("外国語対応タイプの診断結果と一致しています。");
    }
  } else if (patientLanguage !== "ja") {
    // 外国語希望だが完全一致しない場合は軽く減点
    score -= 10;
  }

  /* --- 2. 症状 × 専門性 --- */
  const mainSymptom = getMainSymptom(symptomScore);

  if (mainSymptom === "ibs_skin") {
    if (
      specialties.includes("漢方") ||
      specialties.includes("体質改善") ||
      experiences.includes("IBS") ||
      experiences.includes("皮膚")
    ) {
      score += 25;
      reasons.push("IBS・皮膚トラブルや体質改善の支援経験があります。");
    }
  }

  if (mainSymptom === "cancer") {
    if (specialties.includes("がん") || experiences.includes("がん")) {
      score += 30;
      reasons.push("がん治療中・治療後の薬物療法支援に慣れています。");
    }
  }

  if (mainSymptom === "mental") {
    if (
      specialties.includes("メンタル") ||
      experiences.includes("不眠") ||
      experiences.includes("自律神経失調") ||
      experiences.includes("不安障害")
    ) {
      score += 25;
      reasons.push("メンタル・睡眠・自律神経の相談を多く担当しています。");
    }
  }

  if (mainSymptom === "lifestyle") {
    if (specialties.includes("在宅") || specialties.includes("高齢者ケア")) {
      score += 20;
      reasons.push("在宅・生活習慣病・高齢者ケアの支援が得意です。");
    }
  }

  if (lifestyleScore["support_homecare"] === 1) {
    if (specialties.includes("在宅") || services.includes("在宅")) {
      score += 15;
      reasons.push("在宅医療や訪問対応を重視するニーズに合致しています。");
    }
  }

  /* --- 3. 価値観 × 性格・スタイル --- */
  if (valuePref === "expertise") {
    score += Math.min(years * 2, 20);
    reasons.push(
      `経験年数が比較的長く（${years}年）、専門性を重視する方に向いています。`
    );
  }

  if (valuePref === "empathy") {
    if (
      styleText.includes("丁寧") ||
      styleText.includes("じっくり") ||
      personality.includes("やさ") ||
      personality.includes("穏やか") ||
      personality.includes("共感")
    ) {
      score += 20;
      reasons.push("じっくり話を聞き、共感してくれるスタイルの薬剤師です。");
    }
  }

  if (valuePref === "lifestyle_support") {
    if (
      specialties.includes("在宅") ||
      services.includes("在宅") ||
      services.includes("オンライン相談")
    ) {
      score += 15;
      reasons.push(
        "生活や仕事との両立を含めた現実的な相談に乗ることを得意としています。"
      );
    }
  }

  if (valuePref === "multilingual") {
    if (languages.length > 1) {
      score += 15;
      reasons.push("複数言語でのコミュニケーションに対応できます。");
    }
  }

  /* --- 3-b. 相談スタイル（care_style）との相性 --- */
  if (careStyle) {
    switch (careStyle) {
      case "understanding": {
        const good =
          styleText.includes("丁寧") ||
          styleText.includes("わかりやす") ||
          styleText.includes("説明") ||
          years >= 5;
        if (good) {
          score += 18;
          reasons.push(
            "診断や薬の内容を、わかりやすく丁寧に説明してくれるスタイルです。"
          );
        }
        break;
      }
      case "empathy": {
        const good =
          styleText.includes("じっくり") ||
          styleText.includes("話を聞く") ||
          personality.includes("やさ") ||
          personality.includes("穏やか") ||
          personality.includes("共感");
        if (good) {
          score += 18;
          reasons.push(
            "不安やつらさなどの気持ちも含めて、じっくり寄り添ってくれる薬剤師です。"
          );
        }
        break;
      }
      case "expert": {
        const good =
          years >= 7 ||
          specialties.length >= 2 ||
          styleText.includes("提案") ||
          styleText.includes("方針");
        if (good) {
          score += 18;
          reasons.push(
            "ガイドラインや経験をふまえて、全体の方針を一緒に決めてくれるタイプです。"
          );
        }
        break;
      }
      case "support": {
        const good =
          styleText.includes("伴走") ||
          styleText.includes("一緒に") ||
          styleText.includes("フォロー") ||
          services.includes("オンライン相談") ||
          services.includes("在宅");
        if (good) {
          score += 18;
          reasons.push(
            "続けやすい工夫やペースづくりを、一緒に考えてくれる薬剤師です。"
          );
        }
        break;
      }
      case "family": {
        const good =
          experiences.includes("小児") ||
          experiences.includes("高齢者") ||
          specialties.includes("在宅") ||
          services.includes("在宅") ||
          styleText.includes("家族");
        if (good) {
          score += 18;
          reasons.push(
            "ご自身だけでなく、ご家族の薬や通院も含めて相談しやすい薬剤師です。"
          );
        }
        break;
      }
      case "second_opinion": {
        const good =
          styleText.includes("整理") ||
          styleText.includes("選択肢") ||
          styleText.includes("セカンド") ||
          specialties.length >= 2 ||
          years >= 5;
        if (good) {
          score += 18;
          reasons.push(
            "治療の選択肢やメリット・デメリットを整理しながら、一緒に考えてくれる薬剤師です。"
          );
        }
        break;
      }
    }

    // ★ 患者の相談スタイル と 薬剤師の care_role が一致している場合の強い加点
    if (careRoles.includes(careStyle)) {
      const label = CARE_STYLE_LABEL_MAP[careStyle];
      score += 12;
      reasons.push(
        `この薬剤師は、まさに「${label}」タイプの患者さんを得意とするケアロールとして登録されています。`
      );
    }
  }

  /* --- 4. 顧問薬剤師タイプ（A〜D）による微調整 --- */
  if (type === "A") {
    if (specialties.length >= 2) {
      score += 10;
      reasons.push("複数の専門領域を持つオールラウンダーです。");
    }
  }

  if (type === "B") {
    if (specialties.includes("在宅") || services.includes("在宅")) {
      score += 10;
      reasons.push("生活や在宅ケアを含めた継続支援が得意です。");
    }
  }

  if (type === "C") {
    if (
      specialties.includes("漢方") ||
      specialties.includes("体質改善") ||
      specialties.includes("メンタル")
    ) {
      score += 10;
      reasons.push("漢方・体質改善やメンタル面のケアを重視するタイプです。");
    }
  }

  /* --- 5. 通いやすさ（エリア） --- */
  if (area && pharmacy?.area) {
    if (
      pharmacy.area.includes(area) ||
      area.replace(/\s/g, "").includes(pharmacy.area.replace(/\s/g, ""))
    ) {
      score += 10;
      reasons.push("お住まいのエリアと近い薬局に所属しています。");
    }
  }

  /* --- 6. 重症度に応じて専門性寄りに --- */
  if (severity === "severe") {
    score += Math.min(years * 1.5, 15);
  }

  // スコアを 0〜100 にクリップ
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  // 理由の重複を削除し、最大 3 つまでに絞る
  const uniqueReasons = Array.from(new Set(reasons)).slice(0, 3);

  return { score: normalizedScore, reasons: uniqueReasons };
}

/**
 * 診断画面側で分割した複数の症状キーを、
 * マッチングロジック用のグループスコアにまとめる
 */
function getMainSymptom(scores: Record<string, number>): string | null {
  const groupScores: Record<string, number> = {
    ibs_skin:
      (scores.ibs ?? 0) +
      (scores.skin ?? 0) +
      (scores.ibs_skin ?? 0),
    cancer: scores.cancer ?? 0,
    mental:
      (scores.mental ?? 0) +
      (scores.mental_sleep ?? 0) +
      (scores.mental_mood ?? 0) +
      (scores.mental_autonomic ?? 0),
    pain: scores.pain ?? 0,
    cold_edema: scores.cold_edema ?? 0,
    other_body: scores.other_body ?? 0,
  };

  let maxKey: string | null = null;
  let maxVal = -1;
  for (const [key, val] of Object.entries(groupScores)) {
    if (val > maxVal) {
      maxVal = val;
      maxKey = key;
    }
  }
  if (maxVal <= 0) return null;
  return maxKey;
}
