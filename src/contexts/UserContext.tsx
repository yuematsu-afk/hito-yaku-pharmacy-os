// src/contexts/UserContext.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User, PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { TimeoutError, withTimeout } from "@/lib/withTimeout";

export type AppRole = "patient" | "pharmacist" | "pharmacy_company" | "admin";

type ProfileUserRow = {
  auth_user_id: string;
  role: AppRole | null;
  related_patient_id: string | null;
  related_pharmacy_id: string | null;
  account_type: string | null;
};

export type UserContextValue = {
  loading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  role: AppRole | null;

  relatedPatientId: string | null;
  relatedPharmacyId: string | null;
  accountType: string | null;

  isAdmin: boolean;
  isPharmacyCompany: boolean;

  refresh: () => Promise<void>;
};

export const UserContext = createContext<UserContextValue | null>(null);

// ===== logger: 本番では無音 =====
const IS_PROD = process.env.NODE_ENV === "production";
function log(...args: any[]) {
  if (!IS_PROD) console.log(...args);
}
function warn(...args: any[]) {
  if (!IS_PROD) console.warn(...args);
}
function err(...args: any[]) {
  if (!IS_PROD) console.error(...args);
}

// ---- debug helpers (PIIを極力避ける) ----
function nowIso(): string {
  return new Date().toISOString();
}
function maskUserId(id: string | undefined | null): string | null {
  if (!id) return null;
  return id.slice(0, 8);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [role, setRole] = useState<AppRole | null>(null);
  const [relatedPatientId, setRelatedPatientId] = useState<string | null>(null);
  const [relatedPharmacyId, setRelatedPharmacyId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);

  // 同時実行ガード
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  // 最新実行のみ state を更新する
  const runIdRef = useRef(0);

  // ===== 自己回復制御 =====
  const failCountRef = useRef(0);
  const nextAllowedAtRef = useRef(0); // ms epoch
  const stoppedRef = useRef(false);

  const clearProfileState = useCallback(() => {
    setRole(null);
    setRelatedPatientId(null);
    setRelatedPharmacyId(null);
    setAccountType(null);
  }, []);

  const load = useCallback(async () => {
    // 無限ループ防止：一定回数失敗したら止める
    if (stoppedRef.current) return;

    // バックオフ中ならスキップ（イベント連打対策）
    const now = Date.now();
    if (now < nextAllowedAtRef.current) return;

    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    inFlightRef.current = true;
    pendingRef.current = false;
    const runId = ++runIdRef.current;

    const startedAt = Date.now();
    setLoading(true);

    try {
      // ① session取得（タイムアウト付き）
      const sessionRes = await withTimeout(
        supabase.auth.getSession(),
        8000,
        "supabase.auth.getSession()"
      );

      if (sessionRes.error) throw sessionRes.error;

      const u = sessionRes.data.session?.user ?? null;

      if (runId !== runIdRef.current) return;
      setUser(u);

      if (!u) {
        clearProfileState();
        // 成功扱い（失敗回数リセット）
        failCountRef.current = 0;
        nextAllowedAtRef.current = 0;
        return;
      }

      // ② profile_users取得
      const fetchProfile = async (): Promise<PostgrestSingleResponse<ProfileUserRow>> => {
        return await supabase
          .from("profile_users")
          .select("auth_user_id, role, related_patient_id, related_pharmacy_id, account_type")
          .eq("auth_user_id", u.id)
          .maybeSingle<ProfileUserRow>();
      };

      const profileRes = await withTimeout(fetchProfile(), 8000, "select profile_users");
      if (profileRes.error) throw profileRes.error;

      if (runId !== runIdRef.current) return;

      const pu = profileRes.data ?? null;

      setRole((pu?.role ?? null) as AppRole | null);
      setRelatedPatientId(pu?.related_patient_id ?? null);
      setRelatedPharmacyId(pu?.related_pharmacy_id ?? null);
      setAccountType(pu?.account_type ?? null);

      // 成功：失敗回数リセット
      failCountRef.current = 0;
      nextAllowedAtRef.current = 0;

      log("[UserProvider] load done", {
        at: nowIso(),
        runId,
        elapsedMs: Date.now() - startedAt,
        userId8: maskUserId(u.id),
        role: pu?.role ?? null,
      });
    } catch (e) {
      if (runId !== runIdRef.current) return;

      // 失敗回数 + バックオフ設定
      failCountRef.current += 1;
      const n = failCountRef.current;

      // 1,2,4,8,15秒（上限15秒）
      const delaySec = Math.min(15, Math.pow(2, Math.min(3, n - 1)));
      nextAllowedAtRef.current = Date.now() + delaySec * 1000;

      if (e instanceof TimeoutError) {
        warn("[UserProvider] load timeout", {
          at: nowIso(),
          runId,
          elapsedMs: Date.now() - startedAt,
          message: e.message,
          failCount: n,
          backoffSec: delaySec,
        });
      } else {
        err("[UserProvider] load error", {
          at: nowIso(),
          runId,
          failCount: n,
          backoffSec: delaySec,
          error: e,
        });
      }

      // 安全側：未認証扱い
      setUser(null);
      clearProfileState();

      // 例：5回連続失敗したら“止める”（無限ループ防止）
      if (n >= 5) {
        stoppedRef.current = true;
        warn("[UserProvider] stopped auto-retry (too many failures)", { failCount: n });
      }
    } finally {
      if (runId === runIdRef.current) setLoading(false);

      inFlightRef.current = false;

      if (pendingRef.current) {
        pendingRef.current = false;
        void load();
      }
    }
  }, [clearProfileState]);

  // ===== onAuthStateChange の load() を条件付きにする =====
  const lastAuthUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    void load();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // 本番は無音、開発だけ見る
      log("[UserProvider] onAuthStateChange", { at: nowIso(), event });

      // よくある二重ロード抑止：INITIAL_SESSIONは無視（最初の useEffect(load) があるので）
      if (event === "INITIAL_SESSION") return;

      // user id の変化を検知
      const nextUserId = session?.user?.id ?? null;
      const prevUserId = lastAuthUserIdRef.current;
      lastAuthUserIdRef.current = nextUserId;

      // 明確な変化があるイベントのみ load
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        stoppedRef.current = false; // ここで復帰させる（再ログイン時など）
        void load();
        return;
      }

      // USER_UPDATED は role 等が変わる可能性があるので load
      if (event === "USER_UPDATED") {
        stoppedRef.current = false;
        void load();
        return;
      }

      // TOKEN_REFRESHED は基本スキップ（ここでloadすると“たまに連打”が起きる）
      // ただし userId が変わった時だけ load
      if (event === "TOKEN_REFRESHED") {
        if (nextUserId !== prevUserId) {
          stoppedRef.current = false;
          void load();
        }
        return;
      }

      // それ以外は原則何もしない
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [load]);

  const value: UserContextValue = useMemo(() => {
    const isAuthenticated = !!user;
    const isAdmin = role === "admin";
    const isPharmacyCompany = role === "pharmacy_company";

    return {
      loading,
      isAuthenticated,
      user,
      role,
      relatedPatientId,
      relatedPharmacyId,
      accountType,
      isAdmin,
      isPharmacyCompany,
      refresh: load,
    };
  }, [loading, user, role, relatedPatientId, relatedPharmacyId, accountType, load]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext(): UserContextValue {
  const ctx = React.useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within <UserProvider>");
  return ctx;
}
