"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { appInsights } from "@/lib/appInsights";

export function AppInsightsTracker() {
  // Retrieve the session from NextAuth
  const { data: session } = useSession();

  useEffect(() => {
    if (appInsights) {
      // Access the user ID.
      const userId = (session?.user as any)?.discordId;

      if (userId) {
        // Tag all telemetry with this user's unique identifier
        appInsights.setAuthenticatedUserContext(userId);
      } else {
        // Clear the tag if the user logs out
        appInsights.clearAuthenticatedUserContext();
      }
    }
  }, [session]);

  return null;
}
