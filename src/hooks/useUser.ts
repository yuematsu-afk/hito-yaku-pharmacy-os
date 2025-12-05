// src/hooks/useUser.ts
"use client";

import { useUserContext } from "@/contexts/UserContext";

// アプリ側で扱うロール
export type AppRole = "patient" | "pharmacy_company" | "admin";

// profiles.role に入っている想定のロール
// 互換性のため "pharmacy" も含めるが、今後は "pharmacy_company" を正とする
type DbProfileRole =
  | "patient"
  | "pharmacy"
  | "pharmacy_company"
  | "admin"
  | null;

// DBロール → アプリロール への変換
function dbRoleToAppRole(dbRole: DbProfileRole): AppRole {
  if (dbRole === "admin") return "admin";

  // 旧 "pharmacy" も新 "pharmacy_company" も、アプリ側では同じ扱い
  if (dbRole === "pharmacy" || dbRole === "pharmacy_company") {
    return "pharmacy_company";
  }

  // それ以外 or null はすべて patient 扱い
  return "patient";
}

export function useUser() {
  const ctx = useUserContext();

  const isAuthenticated = !!ctx.user;

  // DB 上のロール（profiles.role）をそのまま保持
  const dbRole = (ctx.profile?.role as DbProfileRole) ?? null;

  // アプリ側で使うロールに変換
  const appRole: AppRole = dbRoleToAppRole(dbRole);

  const isPatient = appRole === "patient";
  const isPharmacyCompany = appRole === "pharmacy_company";
  const isAdmin = appRole === "admin";

  return {
    ...ctx,
    isAuthenticated,
    // ここから先は「アプリ用ロール」を返す
    role: appRole,
    // 必要なら生の DB ロールも見られるようにしておく
    dbRole,
    isPatient,
    isPharmacyCompany,
    isAdmin,
  };
}
