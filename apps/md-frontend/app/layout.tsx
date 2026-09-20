import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";
import { AppInsightsTracker } from "@/components/AppInsightsTracker";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#313338",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: "MicDrop S19",
  description: "Season 19 Platform for MicDrop",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
  openGraph: {
    title: "MicDrop",
    description: "Season 19 Platform for MicDrop",
    url: "/",
    siteName: "MicDrop S19",
    images: [
      {
        url: "/MicDrop19.png",
        width: 512,
        height: 512,
        alt: "MicDrop S19 Logo",
      },
    ],
    locale: "en-US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MicDrop S19",
    description: "Season 19 Platform for MicDrop",
    images: ["/MicDrop19.png"],
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
