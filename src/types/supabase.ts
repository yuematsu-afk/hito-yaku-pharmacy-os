// src/types/supabase.ts

export type PatientType = "A" | "B" | "C" | "D";
export type RelationStatus = 'lead' | 'active' | 'advisor' | 'ended';
export type PrmPriority = 1 | 2 | 3;

export interface Patient {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  symptom_score: Record<string, number> | null;
  lifestyle_score: Record<string, number> | null;
  language: string | null;
  value_preference: string | null;
  severity: string | null;
  area: string | null;
  type: PatientType | null;
  note: string | null;
  care_style: string | null;  
  comm_style: string[] | null;         // ["empathy","logical",...]
  explanation_depth: string | null;    // "simple" | "detailed" | "evidence"
  followup_frequency: string | null;   // "on_demand" | "monthly" | "biweekly_or_more"
  channel_preference: string | null;   // "chat" | "video" | "hybrid"
  
  /** メイン担当薬局（null の場合：まだどこにもひも付いていない見込み患者） */
  pharmacy_id: string | null;

  /** メイン担当薬剤師（null の場合：まだアサインされていない） */
  main_pharmacist_id: string | null;

  /** 薬局との関係ステータス（見込み / 対応中 / 顧問中 / 終了 など） */
  relation_status: RelationStatus;

  /** 次回フォロー予定日 */
  next_contact_at: string | null; // Supabase からは ISO 文字列として受けることが多い想定

  /** 最終フォロー日時 */
  last_contact_at: string | null;

  /** 優先度：1=高, 2=中, 3=低 */
  priority: PrmPriority;

  /** 任意タグ（例：'在宅希望','IBS','家族相談' など） */
  tags: string[] | null;
}

export interface Pharmacy {
  id: string;
  created_at: string;
  name: string;
  area: string | null;
  services: string[] | null;
  has_multilingual_support: boolean;
  note: string | null;
}

export interface Pharmacist {
  id: string;
  created_at: string;
  name: string;
  specialty: string[] | null;
  language: string[] | null;
  consultation_style: string | null;
  experience_case: string[] | null;
  personality: string | null;
  belongs_pharmacy_id: string | null;
  years_of_experience: number | null;
  care_role: string[] | null;
  gender: "女性" | "男性" | "その他" | null;
  gender_other: string | null;
  age_category:
    | "20代"
    | "30代"
    | "40代"
    | "50代"
    | "60代"
    | "70代以上"
    | null; 
}
