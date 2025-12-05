// src/lib/pharmacy-company.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ログインユーザー(auth_user_id)に紐づく薬局法人ID（pharmacies.id）を取得するヘルパー
 *
 * - profile_users.auth_user_id = user.id
 * - profile_users.role = 'pharmacy_company'
 * - profile_users.related_pharmacy_id を返す
 *
 * 該当なし / エラー時は null を返す。
 */
export async function getPharmacyCompanyIdForUser(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profile_users")
    .select("related_pharmacy_id")
    .eq("auth_user_id", authUserId)
    .eq("role", "pharmacy_company")
    .maybeSingle();

  if (error) {
    console.error("[getPharmacyCompanyIdForUser] error", error);
    return null;
  }

  // 型安全のため一旦 any 経由で取り出し
  const row = data as { related_pharmacy_id: string | null } | null;

  return row?.related_pharmacy_id ?? null;
}
