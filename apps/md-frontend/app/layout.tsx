import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";
import { AppInsightsTracker } from "@/components/AppInsightsTracker";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MicDrop",
  description: "Season 19 Management System",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* The Providers wrapper gives session access to ALL pages and layouts */}
        <Providers>
          {/* The AppInsightsTracker component is responsible for tagging telemetry with the user's Discord ID */}
          <AppInsightsTracker />
          {children}
        </Providers>
        <Toaster richColors position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
