// src/components/AdminLogoutButton.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogoutButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // /admin 系のページのときだけ表示
  if (!pathname.startsWith("/admin")) {
    return null;
  }

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/admin-logout", {
        method: "POST",
      });
      router.push("/admin-login");
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="text-xs text-slate-600 border border-slate-300 rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-60"
    >
      {loading ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
