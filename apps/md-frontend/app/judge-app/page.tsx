"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Gavel, Send, Loader2, Disc3, LogOut, Home } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { FormTextarea } from "@/components/FormTextarea";

function JudgeAppForm() {
  const { data: session, status } = useSession();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const router = useRouter();

  const searchParams = useSearchParams();

  const hasShownError = useRef(false);

  const [formData, setFormData] = useState({
    favArtists: "",
    leastFavArtists: "",
    favGenres: "",
    leastFavGenres: "",
    judgingStyle: "",
    safePickCriteria: "",
    givingBonus: false,
    bannedArtists: "",
    amountPreference: "NO_PREFERENCE",
  });

  // Fetch existing data on mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchExistingApp();
    } else if (status === "unauthenticated") {
      setIsInitialLoading(false);
    }
  }, [status]);

  // Trigger an error toast if redirected with an error query param (e.g. after failed auth)
  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "AccessDenied" && !hasShownError.current) {
      hasShownError.current = true; // Ensure the toast only shows once per error occurrence

      toast.error("Access Denied.", {
        description:
          "You do not have permission to access or there was an issue with your account.",
        closeButton: true,
      });

      // Clean up the URL so the toast doesn't trigger again on refresh
      router.replace("/judge-app");
    }
  }, [searchParams, router]);

  const fetchExistingApp = async () => {
    try {
      const res = await api.get("/judge-apps/my-app", {
        validateStatus: (status) => {
          // Accept 200 for existing app, 404 if no app found, and handle other errors in catch block
          return (status >= 200 && status < 300) || status === 404;
        },
      });

      // If app exists, populate form
      if (res.status === 200 && res.data) {
        setFormData(res.data);
        setIsEditMode(true);
      }

      // If 404, it means no existing app, so we just stay with empty form
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post("/judge-apps", formData);
      toast.success(isEditMode ? "Application updated!" : "Application submitted!");
      setIsEditMode(true); // Now we stay in edit mode
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading" || isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#313338] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5865F2]" />
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // If user is not authenticated, show prompt to sign in
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#313338] flex items-center justify-center px-4">
        <div className="bg-[#2B2D31] p-8 rounded-xl shadow-2xl text-center max-w-sm w-full border border-[#1E1F22]">
          <div className="w-16 h-16 bg-[#5865F2] rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg rotate-3">
            <Gavel className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
            MicDrop Judge Application
          </h1>
          <p className="text-[#80848E] mb-6 text-sm">
            You need to be logged in with your Discord account to apply as a judge.
          </p>
          <button
            onClick={() => signIn("discord-judge-app", { callbackUrl: "/judge-app" })}
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
            onClick={() => router.push("/")}
            className="w-full bg-transparent border border-[#4E5058] text-[#DBDEE1] px-4 py-2.5 rounded-md font-semibold hover:bg-[#35373C] transition-colors flex items-center justify-center gap-2 group"
          >
            <Home className="w-4 h-4 text-[#80848E] group-hover:text-[#5865F2] transition-colors" />
            Return to Main App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#313338] py-12 px-4">
      <div className="max-w-2xl mx-auto bg-[#2B2D31] rounded-xl shadow-lg border border-[#1E1F22]">
        <div className="bg-[#1E1F22] p-6 border-b border-[#35373C]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Gavel className="w-6 h-6 text-[#5865F2]" />
                {isEditMode ? "Update Your Application" : "Judge Application"}
              </h1>
            </div>

            {/* Action Buttons Container */}
            <div className="flex items-center gap-2 shrink-0">
              {session?.user?.status !== "INACTIVE" && (
                <button
                  onClick={() => router.push("/")}
                  className="flex items-center gap-2 text-xs font-bold bg-[#35373C] hover:bg-[#4E5058] text-[#DBDEE1] px-3 py-2 rounded transition-colors"
                  title="Return to Dashboard"
                >
                  <Home className="w-4 h-4" />
                  Main App
                </button>
              )}

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-xs font-bold bg-[#35373C] hover:bg-red-500/20 text-[#80848E] hover:text-red-400 px-3 py-2 rounded transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          {isEditMode && (
            <div className="mt-2 bg-[#5865F2]/10 border border-[#5865F2]/20 p-2 rounded text-[#5865F2] text-xs font-medium">
              You have already submitted an application. You can modify it below.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <FormTextarea
            name="favArtists"
            label="Who are some of your favourite artists?"
            sublabel="Provide at least 5."
            value={formData.favArtists}
            onChange={handleChange}
          />

          <FormTextarea
            name="leastFavArtists"
            label="Who are some of your LEAST favourite artists?"
            sublabel="Answer with N/A if there are none."
            value={formData.leastFavArtists}
            onChange={handleChange}
          />

          <FormTextarea
            name="favGenres"
            label="What are some of your favourite genres?"
            sublabel="Provide at least 3, prefer listing sub-genres."
            value={formData.favGenres}
            onChange={handleChange}
          />

          <FormTextarea
            name="leastFavGenres"
            label="What are some of your LEAST favorite genres?"
            sublabel="Answer with N/A if there are none."
            value={formData.leastFavGenres}
            onChange={handleChange}
          />

          <FormTextarea
            name="bannedArtists"
            label="Provide up to 7 artists you want to ban contestants from submitting."
            sublabel="Answer with N/A if you would like to ban none."
            value={formData.bannedArtists}
            onChange={handleChange}
          />

          <FormTextarea
            name="judgingStyle"
            label="Is there anything you would like to mention about your judging style?"
            sublabel="A lengthier explanation of your style in general will be appreciated."
            value={formData.judgingStyle}
            onChange={handleChange}
          />

          <FormTextarea
            name="safePickCriteria"
            label="Clarify your definition of safe picks"
            sublabel="You can use sources such as Spotify playlists, last.fm scrobbles, RYM/AOTY ratings, etc."
            value={formData.safePickCriteria}
            onChange={handleChange}
          />

          <div className="bg-[#1E1F22] p-4 rounded-lg border border-[#35373C] flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#80848E] uppercase tracking-wide">
                Preferred Judging Workload
              </label>
              <select
                name="amountPreference"
                value={formData.amountPreference}
                onChange={handleChange}
                className="w-full bg-[#2B2D31] border border-[#35373C] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2] text-sm mt-1"
              >
                <option value="NO_PREFERENCE">I have no preference</option>
                <option value="MORE">I prefer judging MORE tracks</option>
                <option value="LESS">I prefer judging LESS tracks</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer mt-2 group">
              <div className="relative flex items-center justify-center w-5 h-5 bg-[#2B2D31] border border-[#4E5058] rounded group-hover:border-[#DBDEE1] transition-colors">
                <input
                  type="checkbox"
                  name="givingBonus"
                  checked={formData.givingBonus}
                  onChange={handleChange}
                  className="peer opacity-0 absolute w-full h-full cursor-pointer"
                />
                <div className="hidden peer-checked:block text-[#5865F2]">
                  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
                    <path
                      d="M3 8L6 11L11 3.5"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      stroke="currentColor"
                    ></path>
                  </svg>
                </div>
              </div>
              <span className="text-sm text-[#DBDEE1] font-medium">
                (Optional) Giving Bonus Points (+0.25) to tracks that you have not heard before.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-[#4E5058] text-white font-bold py-3 px-4 rounded-md transition-all flex items-center justify-center gap-2 mt-4 uppercase tracking-wide text-sm"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {isSubmitting
              ? "Processing..."
              : isEditMode
                ? "Update My Application"
                : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JudgeApplicationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#313338] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#5865F2]" />
        </div>
      }
    >
      <JudgeAppForm />
    </Suspense>
  );
}
