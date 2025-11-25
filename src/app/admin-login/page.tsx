// src/app/admin-login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("パスワードが違います");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-20 p-6 border rounded-lg bg-white shadow">
      <h1 className="text-xl font-bold mb-4">管理画面ログイン</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          className="w-full border px-3 py-2 rounded"
          placeholder="パスワードを入力"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full bg-sky-600 text-white py-2 rounded hover:bg-sky-700"
        >
          ログイン
        </button>
      </form>
    </div>
  );
}
