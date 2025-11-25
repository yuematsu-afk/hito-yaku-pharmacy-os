// src/types/prm.ts

import type { Patient, Pharmacist, Pharmacy } from '@/types/supabase';

/**
 * 患者と薬局の関係ステータス
 * lead: 顧問候補・見込み
 * active: 初回対応中・継続フォロー中
 * advisor: 顧問契約中イメージ
 * ended: 対応終了
 */
export type RelationStatus = 'lead' | 'active' | 'advisor' | 'ended';

/**
 * PRM の優先度
 * 1 = 高, 2 = 中, 3 = 低
 */
export type PrmPriority = 1 | 2 | 3;

/**
 * Patient に PRM 用フィールドを足した拡張型
 * （PRM 画面ではこの型を使うと扱いやすい）
 */
export type PatientWithPrm = Patient & {
  main_pharmacist_id: string | null;
  relation_status: RelationStatus;
  next_contact_at: string | null;
  last_contact_at: string | null;
  priority: PrmPriority;
  tags: string[] | null;
  note: string | null;
};

/**
 * PRM 画面でよく使う関連型
 * （薬局・薬剤師と紐づけて扱うとき用のヘルパー）
 */
export type PatientWithRelations = PatientWithPrm & {
  pharmacy_id: string | null;
  main_pharmacist_id: string | null;
  pharmacy: Pharmacy | null;
  main_pharmacist: Pharmacist | null;
};

/**
 * 相談ログ（patient_logs）の1レコード
 */
export type PatientLogChannel =
  | "call"
  | "online"
  | "visit"
  | "message"
  | "other";

export interface PatientLog {
  id: string;
  patient_id: string;
  contact_at: string; // ISO文字列
  channel: PatientLogChannel;
  summary: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}