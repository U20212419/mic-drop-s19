"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Send,
  Link as LinkIcon,
  Star,
  CheckCircle2,
  Lock,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { FormTextarea } from "@/components/FormTextarea";

export default function RoundDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [role, setRole] = useState<string | null>(null);
  const [contestantData, setContestantData] = useState<any>(null);
  const [judgeData, setJudgeData] = useState<any>(null);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [openJudges, setOpenJudges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchRoundData = async () => {
      try {
        const res = await api.get("/my-rounds");
        const info = res.data.find((r: any) => r.idRound === Number(id));

        // If not found, redirect and stop execution
        if (!info) {
          toast.error("Round not found or you don't have access to it.", {
            closeButton: true,
          });
          router.push("/my-rounds");
          return;
        }

        setRole(info.role);

        // Fetch specific details based on role
        const endpoint = info.role === "CONTESTANT" ? "contestant-detail" : "judge-detail";
        const detailRes = await api.get(`/my-rounds/${id}/${endpoint}`);

        if (info.role === "CONTESTANT") {
          setContestantData(detailRes.data);

          const alreadySubmitted =
            detailRes.data.judges.length > 0 &&
            detailRes.data.judges.every((j: any) => j.subLink && j.subLink.trim() !== "");
          setHasSubmitted(alreadySubmitted);
        } else {
          setJudgeData(detailRes.data);
        }
      } catch (error: any) {
        // Error handled by interceptor
      } finally {
        setLoading(false);
      }
    };

    fetchRoundData();
  }, [id, router]);

  const toggleJudge = (discordId: string) => {
    setOpenJudges((prev) => ({ ...prev, [discordId]: !prev[discordId] }));
  };

  const handleLinkChange = (discordId: string, val: string) => {
    if (hasSubmitted) return;

    const newJudges = contestantData.judges.map((j: any) =>
      j.discordId === discordId ? { ...j, subLink: val } : j,
    );

    setContestantData({
      ...contestantData,
      judges: newJudges,
    });
  };

  const allLinksFilled =
    contestantData?.judges?.length > 0 &&
    contestantData.judges.every((j: any) => j.subLink && j.subLink.trim() !== "");

  const handleScoreChange = (idSub: number, e: any) => {
    const rawVal = e.target.value;
    const cursor = e.target.selectionStart;

    let val = rawVal.replace(",", ".");

    // Block non-numeric input except for one decimal point at most
    if (!/^\d*\.?\d*$/.test(val)) {
      const oldScore =
        judgeData.submissions.find((s: any) => s.idSubmission === idSub)?.score ?? "";
      e.target.value = oldScore;
      e.target.setSelectionRange(cursor - 1, cursor - 1);
      return;
    }

    if (val === "") {
      setJudgeData({
        ...judgeData,
        submissions: judgeData.submissions.map((s: any) =>
          s.idSubmission === idSub ? { ...s, score: "" } : s,
        ),
      });
      return;
    }

    if (val === ".") val = "0.";

    let parts = val.split(".");
    if (parts[0].length > 1 && parts[0].startsWith("0")) {
      // Remove leading zeros from the integer part
      parts[0] = parts[0].replace(/^0+/, "");
      if (parts[0] === "") parts[0] = "0";
      val = parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
    }

    // Prevent more than 2 decimal places
    if (val.includes(".")) {
      const newParts = val.split(".");
      if (newParts[1] && newParts[1].length > 2) {
        val = `${newParts[0]}.${newParts[1].slice(0, 2)}`;
      }
    }

    // Validate numeric input and clamp between 0 and 10
    const numVal = parseFloat(val);
    if (!isNaN(numVal)) {
      let finalVal = val;

      if (numVal > 10) finalVal = "10";
      if (numVal < 0) finalVal = "0";

      // Update the input value with the formatted score
      e.target.value = finalVal;

      // Adjust cursor position if formatting changes the value
      if (rawVal !== finalVal) {
        const newCursor = rawVal.length > finalVal.length ? cursor - 1 : cursor;
        e.target.setSelectionRange(newCursor, newCursor);
      }

      setJudgeData({
        ...judgeData,
        submissions: judgeData.submissions.map((s: any) =>
          s.idSubmission === idSub ? { ...s, score: finalVal } : s,
        ),
      });
    }
  };

  const handleReviewChange = (idSub: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJudgeData({
      ...judgeData,
      submissions: judgeData.submissions.map((s: any) =>
        s.idSubmission === idSub ? { ...s, review: val } : s,
      ),
    });
  };

  const submitContestantLinks = async () => {
    if (!allLinksFilled) {
      toast.error("Please provide a track link for all judges before submitting.", {
        closeButton: true,
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        idRound: Number(id),
        submissions: contestantData.judges.map((j: any) => ({
          judgeDiscordId: j.discordId,
          subLink: j.subLink.trim(),
        })),
      };
      await api.post("/my-rounds/batch-submit", payload);
      toast.success("Links submitted successfully.", {
        closeButton: true,
      });
      setHasSubmitted(true);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const submitJudgeScores = async () => {
    try {
      setSubmitting(true);
      const payload = {
        idRound: Number(id),
        scores: judgeData.submissions.map((s: any) => ({
          idSubmission: s.idSubmission,
          score: s.score === "" || s.score === null ? null : Number(s.score),
          review: s.review || "",
        })),
      };
      (await api.put("/my-rounds/batch-score", payload),
        toast.success("Scores saved successfully.", {
          closeButton: true,
        }));
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-full min-h-100">
        <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-[#2B2D31] p-6 rounded-xl border border-[#1E1F22] flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Round {role === "CONTESTANT" ? contestantData?.roundNumber : judgeData?.roundNumber}
          </h1>
          <p className="text-[#80848E] text-sm mt-1">
            Group:{" "}
            <span className="font-bold text-[#DBDEE1]">
              Group {role === "CONTESTANT" ? contestantData?.groupNumber : judgeData?.groupNumber}
            </span>
          </p>
        </div>
        <div className="px-3 py-1 bg-[#35373C] border border-[#4E5058] rounded text-sm font-bold text-[#DBDEE1]">
          {role}
        </div>
      </div>

      {role === "CONTESTANT" && contestantData && (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-lg border flex items-center gap-3 ${
              contestantData.submissionsOpen === false
                ? "bg-yellow-500/10 border-yellow-500/20"
                : hasSubmitted
                  ? "bg-green-500/10 border-green-500/20"
                  : "bg-[#2B2D31] border-[#1E1F22]"
            }`}
          >
            {contestantData.submissionsOpen === false ? (
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-yellow-500 shrink-0" />
                <p className="text-yellow-500/90 text-sm font-medium">
                  The deadline has passed. Submissions are now closed for this round.
                </p>
              </div>
            ) : hasSubmitted ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <p className="text-green-400/90 text-sm font-medium">
                  You have already submitted your tracks for this round. Best of luck!
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#5865F2] shrink-0" />
                <p className="text-[#80848E] text-sm">
                  Review the preferences of each judge in your group and submit your track links
                  below.{" "}
                  <strong className="text-[#DBDEE1]">
                    You must provide a link for every judge to submit.
                  </strong>
                </p>
              </div>
            )}
          </div>

          {contestantData.judges.map((judge: any) => (
            <div
              key={judge.discordId}
              className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] overflow-hidden"
            >
              {/* Card Header */}
              <button
                onClick={() => toggleJudge(judge.discordId)}
                className={`w-full px-5 py-4 flex justify-between items-center transition-colors bg-[#1E1F22]/30 hover:bg-[#1E1F22]/80 ${
                  openJudges[judge.discordId] ? "border-b border-[#1E1F22]" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
                      <Star className="w-4 h-4 text-[#5865F2]" />
                    </div>
                    <span className="font-bold text-[#DBDEE1] text-lg">
                      Judge: {judge.username}
                    </span>
                  </h2>
                </div>

                {/* Expand/Collapse icon */}
                <div
                  className={`p-1 rounded-full transition-all duration-200 ${openJudges[judge.discordId] ? "bg-[#5865F2]/20 text-[#5865F2]" : "text-[#80848E]"}`}
                >
                  {openJudges[judge.discordId] ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </button>

              {openJudges[judge.discordId] && (
                <div className="p-6 space-y-4">
                  <div className="bg-[#1E1F22] border border-[#35373C] p-4 rounded space-y-3">
                    <ReadField label="Favourite artists" val={judge.judgeApp?.favArtists} />
                    <ReadField
                      label="Least favourite artists"
                      val={judge.judgeApp?.leastFavArtists}
                    />
                    <ReadField label="Favourite genres" val={judge.judgeApp?.favGenres} />
                    <ReadField
                      label="Least favourite genres"
                      val={judge.judgeApp?.leastFavGenres}
                    />
                    <ReadField label="Banned artists" val={judge.judgeApp?.bannedArtists} />
                    <ReadField label="Judging style" val={judge.judgeApp?.judgingStyle} />
                    <ReadField label="Safe pick criteria" val={judge.judgeApp?.safePickCriteria} />
                    <ReadField
                      label="Will the judge give bonus points (+0.25) to tracks they have not heard before?"
                      val={judge.judgeApp?.givingBonus ? "Yes" : "No"}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#80848E] uppercase tracking-wide flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-[#5865F2]" /> Track Link for{" "}
                      {judge.username}
                    </label>

                    {/* If the contestant has already submitted or submissions are closed, show the link. Otherwise, show the input field. */}
                    {hasSubmitted || !contestantData.submissionsOpen ? (
                      <div className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-4 py-3 flex items-center justify-between">
                        {judge.subLink ? (
                          <span className="truncate text-sm pr-4 opacity-70">{judge.subLink}</span>
                        ) : (
                          <span className="text-[#80848E] text-sm italic">No link provided</span>
                        )}
                        {judge.subLink ? (
                          <a
                            href={judge.subLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5865F2] hover:underline text-xs font-bold flex items-center shrink-0"
                          >
                            <span>View Submitted Track</span>
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <input
                        type="url"
                        placeholder="YouTube link"
                        value={judge.subLink || ""}
                        onChange={(e) => handleLinkChange(judge.discordId, e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-4 py-3 outline-none focus:border-[#5865F2] focus:bg-[#111214] transition-all"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!hasSubmitted && contestantData.submissionsOpen && (
            <div className="pt-4 flex justify-end">
              <button
                onClick={submitContestantLinks}
                disabled={submitting || !allLinksFilled}
                className={`font-bold py-3 px-8 rounded-md transition-all flex items-center gap-2 text-white
                  ${
                    submitting || !allLinksFilled
                      ? "bg-[#4E5058] cursor-not-allowed opacity-50"
                      : "bg-[#5865F2] hover:bg-[#4752C4]"
                  }`}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                Submit All Links
              </button>
            </div>
          )}
        </div>
      )}

      {role === "JUDGE" && judgeData && (
        <div className="space-y-4">
          <p className="text-[#80848E] text-sm bg-[#2B2D31] p-4 rounded-lg border border-[#1E1F22]">
            Review the tracks submitted to you and assign a score between 0 and 10 (increments of
            0.25).
          </p>

          {judgeData.submissions.length === 0 ? (
            <div className="text-center py-12 bg-[#2B2D31] rounded-xl border border-[#1E1F22]">
              <p className="text-[#80848E]">No submissions have been assigned to you yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {judgeData.submissions.map((sub: any, idx: number) => (
                <div
                  key={sub.idSubmission}
                  className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] p-5 flex flex-col gap-5"
                >
                  {/* Track info and score input */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#5865F2]/20 text-[#5865F2] text-xs font-bold px-2 py-1 rounded">
                          Track #{idx + 1}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {sub.subLink ? (
                          <a
                            href={sub.subLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5865F2] hover:underline text-sm font-medium flex items-center gap-2 w-fit"
                          >
                            <LinkIcon className="w-4 h-4" /> Listen to Track
                          </a>
                        ) : (
                          <span className="text-[#80848E] text-sm italic">
                            No link submitted yet.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-[#1E1F22] p-4 rounded-lg border border-[#35373C] shrink-0">
                      <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center">
                        <Star className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] text-[#80848E] font-bold uppercase mb-1">
                          Score (0-10)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={sub.score ?? ""}
                          onChange={(e) => handleScoreChange(sub.idSubmission, e)}
                          className="w-24 bg-[#2B2D31] border border-[#4E5058] text-white rounded px-3 py-2 outline-none focus:border-[#5865F2] font-mono text-center"
                          placeholder="--"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Review textarea */}
                  <div className="border-t border-[#1E1F22] pt-4 mt-2">
                    <FormTextarea
                      name={`review-${sub.idSubmission}`}
                      label={`Review for Track #${idx + 1}`}
                      sublabel="Explain why you gave this score."
                      value={sub.review || ""}
                      onChange={(e) => handleReviewChange(sub.idSubmission, e)}
                      required={false} // Cambia a true si quieres obligarlos a escribir algo
                    />
                  </div>
                </div>
              ))}

              <div className="pt-6 flex justify-end">
                <button
                  onClick={submitJudgeScores}
                  disabled={submitting}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-md font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Save Scores
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReadField({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <p className="text-[#80848E] text-[10px] font-bold uppercase mb-1">{label}</p>
      <div className="bg-[#1E1F22] border border-[#35373C] p-3 rounded-md text-[#DBDEE1] text-sm whitespace-pre-wrap">
        {val}
      </div>
    </div>
  );
}
