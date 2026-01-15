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

/** ---- logging (prodではlog/warnを無効化) ---- */
const IS_PROD = process.env.NODE_ENV === "production";
const log = (...args: any[]) => {
  if (!IS_PROD) console.log(...args);
};
const warn = (...args: any[]) => {
  if (!IS_PROD) console.warn(...args);
};
// error は本番でも出す（監視のため）
const errLog = (...args: any[]) => console.error(...args);

/** ---- debug helpers (PIIを極力避ける) ---- */
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
  const [relatedPharmacyId, setRelatedPharmacyId] = useState<string | null>(
    null
  );
  const [accountType, setAccountType] = useState<string | null>(null);

  // 同時実行ガード
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  // 最新実行のみ state を更新する
  const runIdRef = useRef(0);

  // onAuthStateChange からの無駄な load() を抑制するための履歴
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const lastLoadAtRef = useRef<number>(0);

  // “詰まったら自己回復” 用
  const retryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearProfileState = useCallback(() => {
    setRole(null);
    setRelatedPatientId(null);
    setRelatedPharmacyId(null);
    setAccountType(null);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback(
    (reason: string) => {
      // 最大3回まで（0,1,2 → 3回）
      if (retryCountRef.current >= 3) return;

      const attempt = retryCountRef.current + 1;
      retryCountRef.current = attempt;

      const backoffMs = Math.min(8000, 1000 * Math.pow(2, attempt - 1)); // 1s,2s,4s（最大8s）
      warn("[UserProvider] self-heal retry scheduled", {
        at: nowIso(),
        attempt,
        backoffMs,
        reason,
      });

      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void load(); // load は useCallback で下に定義（関数巻き上げOK）
      }, backoffMs);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearRetryTimer]
  );

  const load = useCallback(async () => {
    // 連打の最小間隔（onAuthStateChangeの多重発火対策）
    const now = Date.now();
    if (now - lastLoadAtRef.current < 250) {
      // 直近すぎるなら pending に回す（inFlightの時と同様の扱い）
      pendingRef.current = true;
      return;
    }
    lastLoadAtRef.current = now;

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

      // user が変わったら（or null→user / user→null）リトライ回数リセット
      const uid = u?.id ?? null;
      if (uid !== lastLoadedUserIdRef.current) {
        retryCountRef.current = 0;
        clearRetryTimer();
      }

      setUser(u);

      if (!u) {
        lastLoadedUserIdRef.current = null;
        clearProfileState();
        return; // finallyでloading=false
      }

      // ② profile_users取得
      const fetchProfile = async (): Promise<
        PostgrestSingleResponse<ProfileUserRow>
      > => {
        return await supabase
          .from("profile_users")
          .select(
            "auth_user_id, role, related_patient_id, related_pharmacy_id, account_type"
          )
          .eq("auth_user_id", u.id)
          .maybeSingle<ProfileUserRow>();
      };

      const profileRes = await withTimeout(
        fetchProfile(),
        8000,
        "select profile_users"
      );

      if (profileRes.error) throw profileRes.error;

      if (runId !== runIdRef.current) return;

      const pu = profileRes.data ?? null;

      setRole((pu?.role ?? null) as AppRole | null);
      setRelatedPatientId(pu?.related_patient_id ?? null);
      setRelatedPharmacyId(pu?.related_pharmacy_id ?? null);
      setAccountType(pu?.account_type ?? null);

      lastLoadedUserIdRef.current = u.id;

      // 成功したら自己回復カウンタをリセット
      retryCountRef.current = 0;
      clearRetryTimer();

      log("[UserProvider] load done", {
        at: nowIso(),
        runId,
        elapsedMs: Date.now() - startedAt,
        userId8: maskUserId(u.id),
        role: pu?.role ?? null,
      });
    } catch (e) {
      if (runId !== runIdRef.current) return;

      if (e instanceof TimeoutError) {
        warn("[UserProvider] load timeout", {
          at: nowIso(),
          runId,
          elapsedMs: Date.now() - startedAt,
          message: e.message,
        });

        // “詰まったら自己回復”
        scheduleRetry("timeout");
      } else {
        errLog("[UserProvider] load error", e);

        // タイムアウト以外でも一時障害はありえるので軽く自己回復（ただし回数制限）
        scheduleRetry("non-timeout error");
      }

      // 安全側：未認証扱い
      setUser(null);
      lastLoadedUserIdRef.current = null;
      clearProfileState();
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
      }

      inFlightRef.current = false;

      if (pendingRef.current) {
        pendingRef.current = false;
        void load();
      }
    }
  }, [clearProfileState, clearRetryTimer, scheduleRetry]);

  /** onAuthStateChange で load() するかどうかの判定 */
  const shouldLoadForEvent = useCallback(
    (event: string, sessionUserId: string | null) => {
      // SIGNED_OUT は load せず state クリアは Supabase側セッション→次loadで反映されるが、
      // ここでは即時性のため load を呼ばずにOK（必要ならここで clear しても良い）
      if (event === "SIGNED_OUT") return false;

      // user がいないなら load しても profile は取れないので不要
      if (!sessionUserId) return false;

      // INITIAL_SESSION / SIGNED_IN の二重発火対策：
      // すでに同じ userId をロード済みならスキップ
      if (
        (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
        lastLoadedUserIdRef.current === sessionUserId
      ) {
        return false;
      }

      // TOKEN_REFRESHED は通常ロード不要（必要なら true にする）
      if (event === "TOKEN_REFRESHED") return false;

      // USER_UPDATED も通常はロード不要（必要なら true にする）
      if (event === "USER_UPDATED") return false;

      // その他は実行
      return true;
    },
    []
  );

  useEffect(() => {
    void load();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUserId = session?.user?.id ?? null;

      log("[UserProvider] onAuthStateChange", {
        at: nowIso(),
        event,
        userId8: maskUserId(sessionUserId),
      });

      if (shouldLoadForEvent(event, sessionUserId)) {
        void load();
      }
    });

    return () => {
      data.subscription.unsubscribe();
      clearRetryTimer();
    };
  }, [load, shouldLoadForEvent, clearRetryTimer]);

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
  }, [
    loading,
    user,
    role,
    relatedPatientId,
    relatedPharmacyId,
    accountType,
    load,
  ]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext(): UserContextValue {
  const ctx = React.useContext(UserContext);
  if (!ctx) {
    throw new Error("useUserContext must be used within <UserProvider>");
  }
  return ctx;
}
