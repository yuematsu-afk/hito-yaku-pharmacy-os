// src/hooks/useUser.ts
"use client";

import { useUserContext } from "@/contexts/UserContext";

// アプリ側で扱うロール
export type AppRole = "patient" | "pharmacy_company" | "admin";

// profiles.role に入っている想定のロール（互換含む）
export type DbProfileRole =
  | "patient"
  | "pharmacy"
  | "pharmacy_company"
  | "admin"
  | null;

// DBロール → アプリロール への変換（互換）
function dbRoleToAppRole(dbRole: DbProfileRole): AppRole {
  if (dbRole === "admin") return "admin";
  if (dbRole === "pharmacy" || dbRole === "pharmacy_company") return "pharmacy_company";
  return "patient";
}

export function useUser() {
  const ctx = useUserContext();

  const isAuthenticated = !!ctx.user;

  /**
   * 重要：
   * - いまの UserContext には `profile` が無いので参照しない
   * - role / dbRole が ctx にあればそれを使う
   * - dbRole だけある場合は変換して role を作る
   * - どちらも無い場合は安全側で patient 扱い
   */
  const ctxAny = ctx as unknown as {
    role?: AppRole;
    dbRole?: DbProfileRole;
  };

  const dbRole: DbProfileRole = ctxAny.dbRole ?? null;
  const role: AppRole = ctxAny.role ?? dbRoleToAppRole(dbRole);

  const isPatient = role === "patient";
  const isPharmacyCompany = role === "pharmacy_company";
  const isAdmin = role === "admin";

  return {
    ...ctx,
    isAuthenticated,
    role,
    dbRole,
    isPatient,
    isPharmacyCompany,
    isAdmin,
  };
}
