"use client";

import { SessionProvider } from "next-auth/react";
import { AuthWatcher } from "./AuthWatcher";

export function Providers({ children }: { children: React.ReactNode }) {
  // Wrap the entire application to provide session context everywhere
  return (
    // Refetched on window focus to keep the session up-to-date after the user returns to the app
    <SessionProvider refetchOnWindowFocus={true}>
      <AuthWatcher>{children}</AuthWatcher>
    </SessionProvider>
  );
}
