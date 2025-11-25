// src/components/ui/app-card.tsx
import type { ReactNode } from "react";

interface AppCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * アプリ全体で使う共通カードコンポーネント
 * - 角丸
 * - 枠線
 * - 白背景
 * - ちょっとだけ影
 */
export function AppCard({ children, className = "" }: AppCardProps) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
