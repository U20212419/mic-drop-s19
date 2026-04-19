"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MainPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/home");
    }
  }, [status, router]);

  // Loading spinner
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-[#313338] flex flex-col items-center justify-center text-[#DBDEE1]">
        <div className="w-10 h-10 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium animate-pulse">Setting up...</p>
      </div>
    );
  }

  // Log in screen
  return (
    <div className="min-h-screen bg-[#313338] flex items-center justify-center px-4">
      <div className="bg-[#2B2D31] p-8 rounded-xl shadow-2xl text-center max-w-sm w-full border border-[#1E1F22]">
        <div className="w-16 h-16 bg-[#5865F2] rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg rotate-3">
          <svg
            className="w-8 h-8 text-white -rotate-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">MicDrop</h1>
        <p className="text-[#80848E] text-sm mb-8">Log in with Discord.</p>

        <button
          onClick={() => signIn("discord", { callbackUrl: "/home" })}
          className="w-full bg-[#5865F2] text-white px-4 py-2.5 rounded-md font-semibold hover:bg-[#4752C4] transition-colors flex items-center justify-center gap-2"
        >
          Log in
        </button>
      </div>
    </div>
  );
}
