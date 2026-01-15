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
  const [relatedPharmacyId, setRelatedPharmacyId] = useState<string | null>(
    null
  );
  const [accountType, setAccountType] = useState<string | null>(null);

  // 同時実行ガード
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  // 最新実行のみ state を更新する
  const runIdRef = useRef(0);

  const clearProfileState = useCallback(() => {
    setRole(null);
    setRelatedPatientId(null);
    setRelatedPharmacyId(null);
    setAccountType(null);
  }, []);

  const load = useCallback(async () => {
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
        return; // finallyでloading=false
      }

      // ② profile_users取得
      // ★重要：Supabaseクエリは PostgrestBuilder なので、そのままだと Promise ではない
      // → async IIFE で「Promise<PostgrestSingleResponse<ProfileUserRow>>」にしてから withTimeout に渡す
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

      console.log("[UserProvider] load done", {
        at: nowIso(),
        runId,
        elapsedMs: Date.now() - startedAt,
        userId8: maskUserId(u.id),
        role: pu?.role ?? null,
      });
    } catch (e) {
      if (runId !== runIdRef.current) return;

      if (e instanceof TimeoutError) {
        console.warn("[UserProvider] load timeout", {
          at: nowIso(),
          runId,
          elapsedMs: Date.now() - startedAt,
          message: e.message,
        });
      } else {
        console.error("[UserProvider] load error", e);
      }

      // 安全側：未認証扱い
      setUser(null);
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
  }, [clearProfileState]);

  useEffect(() => {
    void load();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      console.log("[UserProvider] onAuthStateChange", {
        at: nowIso(),
        event,
      });
      void load();
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
