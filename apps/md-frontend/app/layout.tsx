import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MicDrop",
  description: "Season 19 Management System",
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
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  );
}
