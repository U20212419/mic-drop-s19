"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/axios";
import {
  ChevronLeft,
  Save,
  Users,
  Gavel,
  Loader2,
  AlertCircle,
  Skull,
  ChevronUp,
  ChevronDown,
  Calculator,
  Star,
  DownloadCloud,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface AdminSubmission {
  idSubmission: number;
  subLink: string;
  score: number | null;
  review: string | null;
  title: string | null;
  artist: string | null;
  judgeUsername: string;
  contestantUsername: string;
  groupNumber: number;
}

export default function RoundAdminDetailPage() {
  const { data: session, status: authStatus } = useSession();

  const userRole = (session?.user as any)?.role || "USER";
  const isAdmin = userRole === "ADMIN";

  const { id } = useParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State for calculating preliminary statuses
  const [isCalculating, setIsCalculating] = useState(false);
  const [isCalculateModalOpen, setIsCalculateModalOpen] = useState(false);

  // State for applying preliminary statuses (execute eliminations)
  const [isApplying, setIsApplying] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  const [round, setRound] = useState<any>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [originalSubmissions, setOriginalSubmissions] = useState<AdminSubmission[]>([]);

  // Track only modified submissions to avoid sending everything
  const [editedSubs, setEditedSubs] = useState<Record<number, Partial<AdminSubmission>>>({});

  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"contestant" | "judge">("contestant");

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [roundRes, subsRes] = await Promise.all([
        api.get(`/rounds/${id}`),
        api.get(`/rounds/${id}/detail-submissions`),
      ]);
      setRound(roundRes.data);
      setSubmissions(subsRes.data);
      setOriginalSubmissions(subsRes.data);
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (idSubmission: number, field: keyof AdminSubmission, value: string) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.idSubmission === idSubmission ? { ...s, [field]: value } : s)),
    );

    // Compare against original state
    const original = originalSubmissions.find((s) => s.idSubmission === idSubmission);
    if (!original) return;

    setEditedSubs((prev) => {
      const updatedPrev = { ...prev };

      // Get the current values
      const currentSub = submissions.find((s) => s.idSubmission === idSubmission)!;
      const nextTitle = field === "title" ? value : currentSub.title;
      const nextArtist = field === "artist" ? value : currentSub.artist;
      const nextLink = field === "subLink" ? value : currentSub.subLink;

      // Check if the current values differ from the original
      const isDifferent =
        (nextTitle || "") !== (original.title || "") ||
        (nextArtist || "") !== (original.artist || "") ||
        (nextLink || "") !== (original.subLink || "");

      if (isDifferent) {
        // If any value is different from original, add/update in editedSubs
        updatedPrev[idSubmission] = { title: nextTitle, artist: nextArtist, subLink: nextLink };
      } else {
        // If values are back to original, remove from editedSubs
        delete updatedPrev[idSubmission];
      }

      return updatedPrev;
    });
  };

  const handleSave = async () => {
    const modifications = Object.keys(editedSubs).map((key) => {
      const idSub = Number(key);
      const sub = submissions.find((s) => s.idSubmission === idSub)!;
      return {
        idSubmission: sub.idSubmission,
        subLink: sub.subLink,
        title: sub.title,
        artist: sub.artist,
      };
    });

    if (modifications.length === 0) {
      toast.info("No changes to save.");
      return;
    }

    try {
      setIsSaving(true);
      await api.put(`/rounds/${id}/detail-submissions`, { updates: modifications });

      setOriginalSubmissions([...submissions]);
      setEditedSubs({});

      toast.success("Detail changes saved successfully.", {
        description: `${modifications.length} submission${modifications.length !== 1 ? "s" : ""} updated.`,
        closeButton: true,
      });
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsSaving(false);
    }
  };

  const handleCalculateStatuses = async () => {
    try {
      setIsCalculating(true);
      await api.post(`/rounds/${id}/calculate-preliminary-statuses`, {
        groupNumber: selectedGroup,
      });

      toast.success(`Preliminary statuses calculated successfully.`, {
        description: `Contestants in Group ${selectedGroup} have been processed.`,
        closeButton: true,
      });

      setIsCalculateModalOpen(false);
      fetchData();
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApplyStatuses = async () => {
    try {
      setIsApplying(true);
      await api.post(`/rounds/${id}/apply-statuses`, { groupNumber: selectedGroup });

      toast.success(`Statuses applied successfully.`, {
        description: `Contestants in Group ${selectedGroup} have been processed.`,
        closeButton: true,
      });

      setIsApplyModalOpen(false);
      fetchData();
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsApplying(false);
    }
  };

  const handleGenerateSlides = async () => {
    try {
      setIsGeneratingSlides(true);

      // Fetch the file as a blob
      const response = await api.get(`/rounds/${id}/slides/download`, {
        params: {
          groupNumber: selectedGroup,
        },
        responseType: "blob",
      });

      // Create a temporary URL for the blob and trigger the download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Round_${id}_Group_${selectedGroup}_Slides.zip`);
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  // Group the data based on View Mode
  const groupedData = useMemo(() => {
    const groupSubs = submissions.filter((s) => s.groupNumber === selectedGroup);
    const map = new Map<string, { name: string; subs: AdminSubmission[] }>();

    groupSubs.forEach((s) => {
      const key = viewMode === "contestant" ? s.contestantUsername : s.judgeUsername;
      if (!map.has(key)) map.set(key, { name: key, subs: [] });
      map.get(key)!.subs.push(s);
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions, selectedGroup, viewMode]);

  const canExecuteElimination =
    round && !round.submissionsOpen && (round.eliminationAmount || 0) > 0;

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-[#5865F2]" />
      </div>
    );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex flex-col w-full lg:w-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 sm:p-2 -ml-1.5 sm:ml-0 hover:bg-[#35373C] rounded-full text-[#80848E] hover:text-white transition-colors shrink-0 flex items-center justify-center"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <h1 className="text-xl sm:text-2xl font-bold text-white flex flex-wrap items-center gap-2 leading-tight">
              Round {round?.roundNumber} Submissions
              {round?.specialRound && (
                <span className="bg-[#E67E22]/10 text-[#E67E22] border border-[#E67E22]/30 text-[10px] sm:text-xs font-black px-2 sm:px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 shrink-0" /> Special
                </span>
              )}
            </h1>
          </div>
          <p className="text-[#80848E] text-xs sm:text-sm mt-1 ml-8 sm:ml-12">Staff / Admin View</p>
        </div>

        {/* Action Buttons Group (Generate Slides + Save Changes) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start lg:justify-end gap-3 w-full lg:w-auto shrink-0">
          {isAdmin && (
            <button
              onClick={handleGenerateSlides}
              disabled={isGeneratingSlides}
              className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-2.5 sm:py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-md transition-colors font-medium text-sm disabled:opacity-50 shadow-md shrink-0"
            >
              {isGeneratingSlides ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <DownloadCloud className="w-4 h-4 shrink-0" />
              )}
              Generate Slides <span className="hidden sm:inline">(ZIP)</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || Object.keys(editedSubs).length === 0}
            className="w-full sm:w-auto justify-center tabular-nums bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2.5 sm:py-2 rounded-md font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            Save Changes{" "}
            {Object.keys(editedSubs).length > 0 && `(${Object.keys(editedSubs).length})`}
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] p-4 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
        <div className="flex flex-wrap flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#1E1F22] sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none border border-[#35373C] sm:border-none">
            <label className="text-sm font-bold text-[#80848E] uppercase shrink-0">Group:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(Number(e.target.value))}
              className="w-full sm:w-auto bg-[#1E1F22] text-white text-sm rounded border border-[#35373C] px-3 py-1.5 outline-none focus:border-[#5865F2]"
            >
              {Array.from({ length: round?.groupCount || 1 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Group {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="flex bg-[#1E1F22] rounded-lg p-1 border border-[#35373C] shrink-0 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setViewMode("contestant")}
              className={`flex-1 sm:flex-none justify-center px-3 py-1.5 sm:py-1 text-sm rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === "contestant" ? "bg-[#5865F2] text-white font-bold" : "text-[#80848E] hover:text-white"}`}
            >
              <Users className="w-4 h-4 shrink-0" /> By Contestant
            </button>
            <button
              onClick={() => setViewMode("judge")}
              className={`flex-1 sm:flex-none justify-center px-3 py-1.5 sm:py-1 text-sm rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === "judge" ? "bg-[#5865F2] text-white font-bold" : "text-[#80848E] hover:text-white"}`}
            >
              <Gavel className="w-4 h-4 shrink-0" /> By Judge
            </button>
          </div>
        </div>

        <div className="flex flex-wrap flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsCalculateModalOpen(true)}
            disabled={!canExecuteElimination || isCalculating}
            className={`w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 tabular-nums rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${canExecuteElimination ? "bg-[#E67E22] hover:bg-[#D35400] text-white" : "bg-[#35373C] text-[#80848E] cursor-not-allowed"}`}
          >
            {isCalculating ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Calculator className="w-4 h-4 shrink-0" />
            )}
            Calculate Statuses <span className="hidden sm:inline">(G{selectedGroup})</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsApplyModalOpen(true)}
              disabled={!canExecuteElimination || isApplying}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 tabular-nums rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${canExecuteElimination ? "bg-red-500 hover:bg-red-600 text-white" : "bg-[#35373C] text-[#80848E] cursor-not-allowed"}`}
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Skull className="w-4 h-4 shrink-0" />
              )}
              Apply Statuses <span className="hidden sm:inline">(G{selectedGroup})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        {groupedData.map((group) => {
          const hasMissingSubs = viewMode === "contestant" && group.subs.some((s) => !s.subLink);
          const isExpanded = expandedGroups[group.name] ?? false;

          return (
            <div
              key={group.name}
              className={`bg-[#2B2D31] rounded-xl border ${hasMissingSubs ? "border-red-500/50" : "border-[#1E1F22]"} overflow-hidden`}
            >
              {/* Card Header */}
              <button
                onClick={() => toggleGroup(group.name)}
                className={`w-full px-4 sm:px-5 py-4 flex justify-between items-center transition-colors gap-4 ${
                  hasMissingSubs
                    ? "bg-red-500/5 hover:bg-red-500/10"
                    : "bg-[#1E1F22]/30 hover:bg-[#1E1F22]/80"
                } ${isExpanded ? "border-b border-[#1E1F22]" : ""}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-left">
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    {viewMode === "contestant" ? (
                      <Users className="w-5 h-5 text-[#5865F2] shrink-0" />
                    ) : (
                      <Gavel className="w-5 h-5 text-yellow-500 shrink-0" />
                    )}
                    <span className="truncate">{group.name}</span>
                  </h2>

                  {/* Badges and counters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-[#2B2D31] border border-[#35373C] text-[#80848E] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shrink-0">
                      {group.subs.length} Track{group.subs.length !== 1 && "s"}
                    </span>
                    {hasMissingSubs && (
                      <span className="bg-red-500/20 text-red-400 text-[10px] sm:text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm shrink-0">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="sm:inline">Missing Submissions</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand/Collapse Icon */}
                <div
                  className={`p-1 rounded-full transition-all duration-200 shrink-0 ${isExpanded ? "bg-[#5865F2]/20 text-[#5865F2]" : "text-[#80848E]"}`}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 shrink-0" />
                  )}
                </div>
              </button>

              {/* Submissions List */}
              {isExpanded && (
                <div className="p-5 space-y-6">
                  {group.subs.map((sub) => (
                    <div
                      key={sub.idSubmission}
                      className="bg-[#1E1F22] rounded-lg p-4 border border-[#35373C]"
                    >
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Left: Editable Metadata */}
                        <div className="flex-1 space-y-4">
                          <div>
                            <p className="text-xs font-bold text-[#80848E] uppercase mb-1">
                              {viewMode === "contestant" ? "To Judge" : "From Contestant"}
                            </p>
                            <p className="text-[#DBDEE1] font-medium">
                              {viewMode === "contestant"
                                ? sub.judgeUsername
                                : sub.contestantUsername}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-[#80848E] font-bold uppercase mb-1">
                                Song Title
                              </label>
                              <input
                                type="text"
                                value={sub.title || ""}
                                onChange={(e) =>
                                  handleInputChange(sub.idSubmission, "title", e.target.value)
                                }
                                className="w-full bg-[#2B2D31] border border-[#35373C] text-white rounded px-3 py-1.5 text-sm outline-none focus:border-[#5865F2]"
                                placeholder="e.g. New Romantics"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#80848E] font-bold uppercase mb-1">
                                Artist
                              </label>
                              <input
                                type="text"
                                value={sub.artist || ""}
                                onChange={(e) =>
                                  handleInputChange(sub.idSubmission, "artist", e.target.value)
                                }
                                className="w-full bg-[#2B2D31] border border-[#35373C] text-white rounded px-3 py-1.5 text-sm outline-none focus:border-[#5865F2]"
                                placeholder="e.g. Taylor Swift"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-[#80848E] font-bold uppercase mb-1">
                              Track Link
                            </label>
                            <input
                              type="url"
                              value={sub.subLink || ""}
                              onChange={(e) =>
                                handleInputChange(sub.idSubmission, "subLink", e.target.value)
                              }
                              className="w-full bg-[#2B2D31] border border-[#35373C] text-white rounded px-3 py-1.5 text-sm outline-none focus:border-[#5865F2]"
                              placeholder="Not submitted yet"
                            />
                          </div>
                        </div>

                        {/* Right: Read-Only Judge Data */}
                        <div className="lg:w-1/3 bg-[#2B2D31] rounded p-4 border border-[#35373C] flex flex-col">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-[#80848E] uppercase">
                              Assigned Score
                            </span>
                            <span className="text-xl font-bold text-yellow-400 font-mono">
                              {sub.score !== null ? sub.score : "--"}
                            </span>
                          </div>
                          <div className="flex-1">
                            <span className="text-xs font-bold text-[#80848E] uppercase block mb-1">
                              Judge Review
                            </span>
                            <div className="text-sm text-[#DBDEE1] bg-[#1E1F22] p-2 rounded border border-[#35373C] min-h-15 max-h-25 overflow-y-auto custom-scrollbar opacity-70">
                              {sub.review || (
                                <span className="italic text-[#4E5058]">
                                  No review provided yet.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {groupedData.length === 0 && (
          <div className="text-center p-10 text-[#80848E] bg-[#2B2D31] rounded-xl border border-[#1E1F22]">
            No submissions found for Group {selectedGroup}.
          </div>
        )}
      </div>

      {/* Calculate Statuses Confirmation Modal */}
      {isCalculateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#E67E22]/10 flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-8 h-8 text-[#E67E22]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Calculate Statuses</h2>
              <p className="text-[#80848E] text-sm">
                Are you sure you want to calculate statuses for{" "}
                <strong className="text-[#DBDEE1]">Group {selectedGroup}</strong>?
              </p>
              <p className="text-[#80848E] text-xs mt-3 bg-[#1E1F22] p-3 rounded border border-[#35373C]">
                This will recalculate statuses for all users in this group (DID_NOT_SUBMIT,
                ELIMINATED, or ACTIVE). Users will not see these changes yet. This action may be
                executed again later.
              </p>
            </div>

            <div className="bg-[#1E1F22] p-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCalculateModalOpen(false)}
                disabled={isCalculating}
                className="px-4 py-2 text-sm font-medium text-[#DBDEE1] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCalculateStatuses}
                disabled={isCalculating}
                className="bg-[#E67E22] hover:bg-[#D35400] text-white px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCalculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isCalculating ? "Calculating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Statuses Confirmation Modal */}
      {isAdmin && isApplyModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Skull className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Apply Statuses</h2>
              <p className="text-[#80848E] text-sm">
                Are you sure you want to apply statuses for{" "}
                <strong className="text-[#DBDEE1]">Group {selectedGroup}</strong>?
              </p>
              <p className="text-[#80848E] text-xs mt-3 bg-[#1E1F22] p-3 rounded border border-[#35373C]">
                This will effectively apply calculated statuses for all users in this group
                (DID_NOT_SUBMIT, ELIMINATED, or ACTIVE). Users will be able to see these changes
                once they are applied. This action may be executed again later.
              </p>
            </div>

            <div className="bg-[#1E1F22] p-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                disabled={isApplying}
                className="px-4 py-2 text-sm font-medium text-[#DBDEE1] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyStatuses}
                disabled={isApplying}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isApplying ? "Applying..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
