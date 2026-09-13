"use client";

import api from "@/lib/axios";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function AuthWatcher({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const prevStatus = useRef(status);

  useEffect(() => {
    // If the session status is loadin, wait
    if (status === "loading") return;

    // Detect if the backend injected an error into the session, indicating that the refresh token was rejected or expired
    const sessionError = (session as any)?.error || (session as any)?.user?.error;
    const backendRejected =
      sessionError === "RefreshAccessTokenError" || sessionError === "NoRefreshTokenError";

    // Detect if NextAuth has transitioned from authenticated to unauthenticated, which can happen if the session dies abruptly
    const sessionDiedAbruptly =
      prevStatus.current === "authenticated" && status === "unauthenticated";

    // Check if the backend rejected our refresh token during a background check
    if (backendRejected || sessionDiedAbruptly) {
      // Clear Axios memory just in case
      api.defaults.headers.Authorization = null;

      toast.error("Session expired.", {
        description: "Your session has expired. Please log in again.",
        duration: 6000,
        closeButton: true,
      });

      // Destroy the session without redirecting to the sign-in page, since we want to handle the redirect ourselves
      if (backendRejected) {
        signOut({ redirect: false });
      }

      // Force logout and redirect to the home/login page, giving the user a chance to read the toast message first
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    }

    // Update the previous status for the next effect run
    prevStatus.current = status;
  }, [session, status]);

  return <>{children}</>;
}
