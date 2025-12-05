// src/contexts/UserContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";

// Supabase の profiles テーブルに対応した型
export type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "patient" | "pharmacy" | "admin" | null;
  created_at: string;
};

// Context から見える値の型
export type UserContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

type UserProviderProps = {
  children: ReactNode;
};

export function UserProvider({ children }: UserProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // プロフィール取得処理を共通化
  const fetchProfile = async (u: User | null) => {
    if (!u) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .eq("id", u.id)
      .maybeSingle();

    if (error) {
      console.error("[UserContext] fetchProfile error", error);
      // エラーでも致命的ではないので profile は null のまま
      return;
    }

    if (data) {
      setProfile({
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        created_at: data.created_at,
      });
    } else {
      // まだ profiles 行が無い場合もありうるので null
      setProfile(null);
    }
  };

  // 外部から呼び出せる Profile 更新関数
  const refreshProfile = async () => {
    await fetchProfile(user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  // 初期ロード & 認証状態の購読
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("[UserContext] getSession error", error);
      }

      if (!isMounted) return;

      setSession(session ?? null);
      setUser(session?.user ?? null);

      await fetchProfile(session?.user ?? null);

      if (isMounted) {
        setLoading(false);
      }
    };

    void init();

    // auth state change を購読
    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      await fetchProfile(newSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value: UserContextValue = {
    session,
    user,
    profile,
    loading,
    refreshProfile,
    signOut,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// 直接 useContext を使うのは避けて、専用フック経由で使う想定
export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return ctx;
}
