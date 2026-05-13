"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";
import { Disc3, Gavel, MicVocal } from "lucide-react";

function LoginContent() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/home");
    }
  }, [status, session, router]);

  // Trigger an error toast if redirected with an error query param (e.g. after failed auth)
  useEffect(() => {
    const error = searchParams.get("error");
    const callbackUrl = searchParams.get("callbackUrl");

    if (!error) return;

    if (error === "Callback") {
      if (callbackUrl?.includes("/judge-app")) {
        // Canceled from the judge application page
        router.replace("/judge-app");
      } else {
        // Canceled from the main app login page
        router.replace("/");
      }
    } else if (error === "AccessDenied") {
      toast.error("Access Denied.", {
        description:
          "You do not have permission to access or there was an issue with your account.",
        closeButton: true,
      });
      // Clean up the URL so the toast doesn't trigger again on refresh
      router.replace("/");
    }
  }, [searchParams, router]);

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
          <MicVocal className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">MicDrop</h1>
        <p className="text-[#80848E] mb-6 text-sm">
          You need to be logged in with your Discord account to access the Season 19 dashboard.
        </p>
        <button
          onClick={() => signIn("discord", { callbackUrl: "/home" })}
          className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
        >
          <Disc3 className="w-5 h-5" />
          Login with Discord
        </button>

        <div className="flex items-center gap-2 py-2">
          <div className="h-px bg-[#35373C] flex-1"></div>
          <span className="text-[10px] font-bold text-[#4E5058] uppercase">or</span>
          <div className="h-px bg-[#35373C] flex-1"></div>
        </div>

        <button
          onClick={() => router.push("/judge-app")}
          className="w-full bg-transparent border border-[#4E5058] text-[#DBDEE1] px-4 py-2.5 rounded-md font-semibold hover:bg-[#35373C] transition-colors flex items-center justify-center gap-2 group"
        >
          <Gavel className="w-4 h-4 text-[#80848E] group-hover:text-[#5865F2] transition-colors" />
          Judge Application
        </button>
      </div>
    </div>
  );
}

export default function MainPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#313338] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
