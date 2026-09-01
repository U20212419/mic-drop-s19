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

  const [collection, setCollection] = useState<any[]>([]);
  const [selectedForCollection, setSelectedForCollection] = useState<string[]>([]);

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
          let fetchedData = detailRes.data;

          const alreadySubmitted =
            fetchedData.judges.length > 0 &&
            fetchedData.judges.every((j: any) => j.subLink && j.subLink.trim() !== "");
          setHasSubmitted(alreadySubmitted);

          // Load links from cache if available
          if (!alreadySubmitted) {
            const cachedDraft = localStorage.getItem(`micdrop-round-${id}-draft`);
            if (cachedDraft) {
              try {
                const parsedDraft = JSON.parse(cachedDraft);

                // Verify if there are any saved data
                const hasRealData =
                  (parsedDraft.judges &&
                    parsedDraft.judges.some((j: any) => j.subLink && j.subLink.trim() !== "")) ||
                  (parsedDraft.selectedForCollection &&
                    parsedDraft.selectedForCollection.length > 0);

                if (hasRealData) {
                  // Merge cached links with fresh API data
                  fetchedData.judges = fetchedData.judges.map((j: any) => {
                    const cachedJudge = parsedDraft.judges?.find(
                      (cj: any) => cj.discordId === j.discordId,
                    );
                    return cachedJudge ? { ...j, subLink: cachedJudge.subLink || "" } : j;
                  });

                  // Restore selectedForCollection from cache if available
                  if (parsedDraft.selectedForCollection) {
                    setSelectedForCollection(parsedDraft.selectedForCollection);
                  }

                  toast.info("Draft recovered from your previous session.", { closeButton: true });
                }
              } catch (e) {
                console.error("Failed to parse cached draft:", e);
              }
            }
          }

          setContestantData(fetchedData);

          // If it's a special round, fetch the user's collection
          if (fetchedData.specialRound) {
            const colRes = await api.get("/my-rounds/collection");
            setCollection(colRes.data);
          }
        } else {
          // Parse judge data to extract the bonus state from the DB cleanly
          // This separates the visual state (base score) from the backend state
          const parsedSubmissions = detailRes.data.submissions.map((s: any) => {
            const hasBonus = s.review?.includes("(+0.25)") || false;
            let displayScore = s.score !== null && s.score !== undefined ? s.score.toString() : "";
            let displayReview = s.review || "";

            if (hasBonus) {
              // Strip the bonus from the UI so it doesn't double-stack visually
              if (displayScore !== "") {
                displayScore = (parseFloat(displayScore) - 0.25).toString();
              }
              displayReview = displayReview.replace(" (+0.25)", "").replace("(+0.25)", "").trim();
            }

            return {
              ...s,
              score: displayScore,
              review: displayReview,
              hasBonus: hasBonus,
            };
          });
          setJudgeData({
            ...detailRes.data,
            submissions: parsedSubmissions,
          });
        }
      } catch (error: any) {
        // Error handled by interceptor
      } finally {
        setLoading(false);
      }
    };

    fetchRoundData();
  }, [id, router]);

  // Auto save to cache
  useEffect(() => {
    // Only save if the user is a contestant, data exists, and hasn't finally submitted
    if (role === "CONTESTANT" && contestantData?.judges && !hasSubmitted) {
      const draft = {
        judges: contestantData.judges.map((j: any) => ({
          discordId: j.discordId,
          subLink: j.subLink,
        })),
        selectedForCollection,
      };
      localStorage.setItem(`micdrop-round-${id}-draft`, JSON.stringify(draft));
    }
  }, [contestantData, selectedForCollection, role, hasSubmitted, id]);

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

  const handleCollectionToggle = (discordId: string) => {
    setSelectedForCollection((prev) => {
      if (prev.includes(discordId)) return prev.filter((id) => id !== discordId);

      if (prev.length >= 3) {
        toast.error("You can only add 3 songs to your collection.", { closeButton: true });
        return prev;
      }

      return [...prev, discordId];
    });
  };

  const allLinksFilled =
    contestantData?.judges?.length > 0 &&
    contestantData.judges.every((j: any) => j.subLink && j.subLink.trim() !== "");

  const handleScoreChange = (sub: any, e: any) => {
    if (!sub) return;

    const rawVal = e.target.value;
    const cursor = e.target.selectionStart;

    let val = rawVal.replace(",", ".");

    // Block non-numeric input except for one decimal point at most
    if (!/^\d*\.?\d*$/.test(val)) {
      const oldScore =
        judgeData.submissions.find((s: any) => s.idSubmission === sub.idSubmission)?.score ?? "";
      e.target.value = oldScore;
      e.target.setSelectionRange(cursor - 1, cursor - 1);
      return;
    }

    if (val === "") {
      setJudgeData({
        ...judgeData,
        submissions: judgeData.submissions.map((s: any) =>
          s.idSubmission === sub.idSubmission ? { ...s, score: "" } : s,
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

      // Automatically remove the bonus if the manual score is 9 or above
      let newHasBonus = sub.hasBonus || false;
      if (parseFloat(finalVal) >= 9 && newHasBonus) {
        newHasBonus = false;
      }

      setJudgeData({
        ...judgeData,
        submissions: judgeData.submissions.map((s: any) =>
          s.idSubmission === sub.idSubmission
            ? { ...s, score: finalVal, hasBonus: newHasBonus }
            : s,
        ),
      });
    }
  };

  const handleReviewChange = (sub: any, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!sub) return;

    const newValue = e.target.value;

    setJudgeData({
      ...judgeData,
      submissions: judgeData.submissions.map((s: any) =>
        s.idSubmission === sub.idSubmission ? { ...s, review: newValue } : s,
      ),
    });
  };

  const handleBonusToggle = (sub: any, isChecked: boolean) => {
    if (!sub) return;

    const currentScore = parseFloat(sub.score || "0");
    if (isNaN(currentScore)) return; // Do not allow toggling if the score is invalid

    // If the score is 9 or above, prevent adding the bonus
    if (isChecked && currentScore >= 9) return;

    setJudgeData((prev: any) => ({
      ...prev,
      submissions: prev.submissions.map((s: any) =>
        s.idSubmission === sub.idSubmission ? { ...s, hasBonus: isChecked } : s,
      ),
    }));
  };

  const submitContestantLinks = async () => {
    if (!allLinksFilled) {
      toast.error("Please provide a track link for all judges before submitting.", {
        closeButton: true,
      });
      return;
    }

    // Client-side validations for collections
    if (contestantData.specialRound) {
      // Validate that there's enough quantity if they picked the same song multiple times
      const counts: Record<string, number> = {};
      for (const j of contestantData.judges) {
        counts[j.subLink] = (counts[j.subLink] || 0) + 1;
      }
      for (const link in counts) {
        const item = collection.find((c) => c.subLink === link);
        if (!item || item.quantity < counts[link]) {
          toast.error(`Not enough copies of a selected song in your collection.`, {
            description: `You selected "${item?.title || link}" ${counts[link]} times, but you only have ${item?.quantity || 0} in your collection.`,
            closeButton: true,
          });
          return;
        }
      }
    } else {
      // Validate 3 selections if the round is normal and there are more than 3 judges
      if (contestantData.judges.length > 3 && selectedForCollection.length !== 3) {
        toast.error("You must select exactly 3 songs to add to your collection.", {
          closeButton: true,
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        idRound: Number(id),
        submissions: contestantData.judges.map((j: any) => ({
          judgeDiscordId: j.discordId,
          subLink: formatExternalUrl(j.subLink),
          addToCollection: selectedForCollection.includes(j.discordId),
        })),
      };
      await api.post("/my-rounds/batch-submit", payload);

      // Clear cache on success
      localStorage.removeItem(`micdrop-round-${id}-draft`);

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
        scores: judgeData.submissions.map((s: any) => {
          let finalScore = s.score === "" || s.score === null ? null : Number(s.score);
          if (finalScore !== null && s.hasBonus) {
            finalScore += 0.25;
          }

          let finalReview = s.review || "";
          if (s.hasBonus) {
            finalReview = finalReview.trim() ? `${finalReview.trim()} (+0.25)` : "(+0.25)";
          }
          return {
            idSubmission: s.idSubmission,
            score: finalScore,
            review: finalReview,
          };
        }),
      };
      await api.put("/my-rounds/batch-score", payload);
      toast.success("Scores saved successfully.", {
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to ensure that external URLs are properly formatted with a protocol
  const formatExternalUrl = (url: string) => {
    if (!url) return "";
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Round {role === "CONTESTANT" ? contestantData?.roundNumber : judgeData?.roundNumber}
            {/* Special round badge */}
            {((role === "CONTESTANT" && contestantData?.specialRound) ||
              (role === "JUDGE" && judgeData?.specialRound)) && (
              <span className="bg-[#E67E22]/10 text-[#E67E22] border border-[#E67E22]/30 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Star className="w-3 h-3" /> Special
              </span>
            )}
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
                  {contestantData.specialRound ? (
                    <>
                      This is a <strong className="text-[#E67E22]">Special Round</strong>. You must
                      select tracks from your Collection to submit.
                    </>
                  ) : (
                    <>
                      Review the preferences of each judge in your group and submit your track links
                      below.{" "}
                      <strong className="text-[#DBDEE1]">
                        You must provide a link for every judge to submit.
                      </strong>
                    </>
                  )}
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
                            href={formatExternalUrl(judge.subLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5865F2] hover:underline text-xs font-bold flex items-center shrink-0"
                          >
                            <span>View Submitted Track</span>
                          </a>
                        ) : null}
                      </div>
                    ) : contestantData.specialRound ? (
                      // Special round dropdown
                      <select
                        value={judge.subLink || ""}
                        onChange={(e) => handleLinkChange(judge.discordId, e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-4 py-3 outline-none focus:border-[#5865F2] focus:bg-[#111214] transition-all"
                      >
                        <option value="">Select from your Collection...</option>
                        {collection
                          .filter((item: any) => item.quantity > 0)
                          .map((item: any) => (
                            <option
                              key={item.subLink}
                              value={item.subLink}
                              disabled={item.quantity <= 0}
                            >
                              {item.title || "Unknown Title"} - {item.artist || "Unknown Artist"} (x
                              {item.quantity})
                            </option>
                          ))}
                      </select>
                    ) : (
                      // Normal round input
                      <div className="space-y-3">
                        <input
                          type="url"
                          placeholder="YouTube link"
                          value={judge.subLink || ""}
                          onChange={(e) => handleLinkChange(judge.discordId, e.target.value)}
                          className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-4 py-3 outline-none focus:border-[#5865F2] focus:bg-[#111214] transition-all"
                        />
                        {/* Collection Checkbox */}
                        {contestantData.judges.length > 3 && (
                          <label className="flex items-center gap-2 cursor-pointer w-fit group">
                            <input
                              type="checkbox"
                              checked={selectedForCollection.includes(judge.discordId)}
                              onChange={() => handleCollectionToggle(judge.discordId)}
                              className="w-4 h-4 rounded border-[#35373C] bg-[#1E1F22] text-[#5865F2] focus:ring-[#5865F2] focus:ring-offset-[#2B2D31] cursor-pointer"
                            />
                            <span className="text-sm font-medium text-[#80848E] group-hover:text-[#DBDEE1] transition-colors">
                              Add this track to my Collection
                            </span>
                          </label>
                        )}
                      </div>
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
          <div className="text-[#80848E] bg-[#2B2D31] p-4 rounded-lg border border-[#1E1F22] flex flex-col gap-4 structure-rules">
            <strong>Judging Guidelines:</strong>
            <p className="italic">
              <strong>1.</strong> The score you input into the textbox should{" "}
              <span className="font-semibold">not include bonus points</span> if any are given. Use
              the corresponding <span className="font-semibold">checkbox</span> for that purpose. In
              regards to reviews, a{" "}
              <span className="font-semibold">(+0.25) will automatically be added at the end</span>{" "}
              of reviews to inform us that they were given. You{" "}
              <span className="font-semibold">do not need to add the bonus to your review</span>.
            </p>
            <p className="italic">
              <strong>2.</strong> Bonus points of <span className="font-semibold">(+0.25)</span>{" "}
              should <span className="font-semibold">not be given to scores of 9 and above.</span>
            </p>
            <p className="italic">
              <strong>3.</strong> If you receive{" "}
              <span className="font-semibold">duplicate submissions</span> ensure that you{" "}
              <span className="font-semibold">gave both entries the same scores</span>, reviews
              don't have to be the same. If a song reaches the criteria to become a safe submission{" "}
              <span className="font-semibold">mid-round</span>, you have the choice to{" "}
              <span className="font-semibold">lower the score</span> of the submissions received{" "}
              <span className="font-semibold">after the song becomes safe</span>.
            </p>
            <p className="italic">
              <strong>4.</strong> Judging should be done{" "}
              <span className="font-semibold">as the songs come in</span> rather than leaving them
              once all submissions have been entered. This is done so that results can be announced
              as quickly as possible.
            </p>
            <p className="italic">
              <strong>5.</strong> You may{" "}
              <span className="font-semibold">
                only give <span className="font-semibold">ONE song</span> a score of 10
              </span>{" "}
              per <span className="font-semibold">10</span> contestants judged rounded to the
              nearest 10s.
            </p>
            <p className="italic">
              <strong>6.</strong> There will be a{" "}
              <span className="font-semibold">
                judging deadline of 24 hours after the submission deadline
              </span>
              . Failure of doing so will lead to results being{" "}
              <span className="font-semibold">announced without your scores and reviews</span>.
            </p>
            <p className="italic">
              <strong>7.</strong> While you do hold the right to penalise entries if you{" "}
              <span className="font-semibold">consider them too safe</span>, or have had{" "}
              <span className="font-semibold">multiple of the same entries</span>, ensure the
              penalisation is at a <span className="font-semibold">reasonable amount</span>.{" "}
              <span className="font-semibold">
                This will be due to staff interpretation since it may not be so black and white
              </span>
              .
            </p>
            <p className="italic">
              <strong>8.</strong> You may{" "}
              <span className="font-semibold">add increments of .5 and .25</span> to your scores.
            </p>
            <p className="italic">
              <strong>9.</strong> You can write whatever you want in your reviews, but{" "}
              <span className="font-semibold">ensure that they are appropriate</span>.
            </p>
            <p className="italic">
              <strong>10.</strong> Submissions will be added to this page{" "}
              <span className="font-semibold">as contestants submit them</span>.
            </p>
            <p className="italic">
              <strong>11.</strong> Your reviews of any individual songs must be{" "}
              <span className="font-semibold">lower than 1000 characters</span>. This is done to
              make slides easily readable.
            </p>
          </div>

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

                      {/* Display the track artist and title if available, otherwise show the link */}
                      <div className="mt-3 space-y-2">
                        {sub.artist && sub.title ? (
                          <p className="text-white font-medium">
                            {sub.artist} - {sub.title}
                          </p>
                        ) : (
                          <span className="text-[#80848E] text-sm italic">
                            No artist or title available.
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {sub.subLink ? (
                          <a
                            href={formatExternalUrl(sub.subLink)}
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

                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#1E1F22] p-4 rounded-lg border border-[#35373C] shrink-0">
                      {/* Score Input Block */}
                      <div className="flex items-center gap-3">
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
                            onChange={(e) => handleScoreChange(sub, e)}
                            className="w-24 bg-[#2B2D31] border border-[#4E5058] text-white rounded px-3 py-2 outline-none focus:border-[#5865F2] font-mono text-center"
                            placeholder="--"
                          />
                        </div>
                      </div>

                      {/* Bonus Points Checkbox */}
                      {judgeData.givingBonus && (
                        <div className="flex items-center sm:border-l border-[#35373C] sm:pl-4">
                          <label
                            className={`flex items-center gap-2 text-sm font-medium select-none ${
                              sub.score && parseFloat(sub.score) >= 9
                                ? "text-[#4E5058] cursor-not-allowed"
                                : "text-[#80848E] cursor-pointer"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              checked={sub.hasBonus || false}
                              disabled={!sub.score || parseFloat(sub.score) >= 9}
                              onChange={(e) => handleBonusToggle(sub, e.target.checked)}
                            />
                            Bonus (+0.25)
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Review textarea */}
                  <div className="border-t border-[#1E1F22] pt-4 mt-2">
                    <FormTextarea
                      name={`review-${sub.idSubmission}`}
                      label={`Review for Track #${idx + 1}`}
                      sublabel="Explain why you gave this score."
                      value={sub.review || ""}
                      onChange={(e) => handleReviewChange(sub, e)}
                      placeholder="Write your review here..."
                      required={false}
                    />

                    {/* Visual Indicator of the appended string (Immutable UI representation) */}
                    {sub.hasBonus && (
                      <div className="mt-3 flex justify-end">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5865F2] bg-[#5865F2]/10 px-2.5 py-1.5 rounded-md border border-[#5865F2]/20 select-none cursor-default"
                          title="This tag will be automatically appended to your review upon saving."
                        >
                          <Lock className="w-3 h-3" /> (+0.25) appended to review
                        </span>
                      </div>
                    )}
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
