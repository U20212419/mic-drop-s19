"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Wrap the entire application to provide session context everywhere
  return <SessionProvider>{children}</SessionProvider>;
}
