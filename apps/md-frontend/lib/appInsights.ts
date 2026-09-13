import { ApplicationInsights } from "@microsoft/applicationinsights-web";

let appInsights: ApplicationInsights | null = null;

const connectionString = process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING || "";
const iKeyMatch = connectionString.match(/InstrumentationKey=([^;]+)/i);
const iKey = iKeyMatch ? iKeyMatch[1] : "";

// Validate that we are in a browser environment and that the connection string is provided
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING) {
  appInsights = new ApplicationInsights({
    config: {
      instrumentationKey: iKey,
      endpointUrl: "/ingest/telemetry", // Use the rewrite defined in next.config.ts
      enableAutoRouteTracking: true, // Automatically track route changes in a SPA
      // Network tracking
      disableAjaxTracking: false, // Enable tracking of AJAX requests
      disableFetchTracking: false, // Enable tracking of fetch requests
      enableAjaxErrorStatusText: true, // Capture error status text for AJAX requests
      maxAjaxCallsPerView: 500, // Limit the number of AJAX calls tracked per view to avoid performance issues
      // Exception tracking
      disableExceptionTracking: false, // Enable tracking of unhandled exceptions
      enableUnhandledPromiseRejectionTracking: true, // Enable tracking of unhandled promise rejections
    },
  });
  appInsights.loadAppInsights();
}

export { appInsights };
