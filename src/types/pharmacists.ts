// src/types/pharmacist.ts

// ケアロール分類
export type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

// 性別
export type GenderOption = "" | "女性" | "男性" | "その他";

// 年代
export type AgeCategoryOption =
  | ""
  | "20代"
  | "30代"
  | "40代"
  | "50代"
  | "60代"
  | "70代以上";

// Supabase pharmacists テーブルを拡張
export interface ExtendedPharmacist {
  id: string;
  created_at: string;

  name: string;
  belongs_pharmacy_id: string | null;

  one_line_message: string | null;
  specialty: string[] | null;
  language: string[] | null;

  care_role: CareStyleKey[] | null;

  years_of_experience: number | null;

  // 新規項目
  gender: GenderOption | null;
  gender_other: string | null;

  birth_date: string | null;
  age_category: AgeCategoryOption | null;

  license_number: string | null;

  web_links: string[] | null;
  sns_links: string[] | null;

  image_urls: string[] | null; // 最大5枚
  image_url: string | null; // メイン画像

  visibility: "public" | "members";

  // Supabase pharmacists に元々ある可能性のある項目も保持
  consultation_style?: string | null;
  experience_case?: string[] | null;
  personality?: string | null;
}
