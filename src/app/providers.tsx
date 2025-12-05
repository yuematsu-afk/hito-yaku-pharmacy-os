// src/app/providers.tsx
"use client";

import type { ReactNode } from "react";
import { UserProvider } from "@/contexts/UserContext";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return <UserProvider>{children}</UserProvider>;
}
