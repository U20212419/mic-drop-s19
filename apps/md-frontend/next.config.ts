import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://tenor.com;
  frame-src 'self' https://tenor.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://cdn.discordapp.com https://tenor.com https://media.giphy.com https://media1.tenor.com https://i.imgur.com https://*.imgur.com;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  connect-src 'self' https://*.applicationinsights.azure.com https://dc.services.visualstudio.com;
`;

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // 'afterFiles' rewrites are applied after all other rewrites, allowing us to mask the backend API URL and the App Insights ingestion endpoint
      afterFiles: [
        {
          source: "/ingest/telemetry",
          destination: `${process.env.NEXT_PUBLIC_APPINSIGHTS_INGEST_URL}/v2/track`,
        },
      ],
      // 'fallback' rewrites are applied if no other rewrites match, allowing us to mask the backend API URL
      // This ensures NextAuth handles its own routes first, and only rewrites to the backend API if no other route matches
      fallback: [
        {
          // Mask the backend API URL to avoid exposing it to the frontend
          source: "/api/:path*",
          destination: `${process.env.API_BASE_URL}/api/:path*`,
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader.replace(/\n/g, "") },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
