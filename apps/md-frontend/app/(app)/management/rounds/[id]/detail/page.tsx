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
} from "lucide-react";

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
  const { id } = useParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEliminating, setIsEliminating] = useState(false);
  const [isEliminationModalOpen, setIsEliminationModalOpen] = useState(false);

  const [round, setRound] = useState<any>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [originalSubmissions, setOriginalSubmissions] = useState<AdminSubmission[]>([]);

  // Track only modified submissions to avoid sending everything
  const [editedSubs, setEditedSubs] = useState<Record<number, Partial<AdminSubmission>>>({});

  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"contestant" | "judge">("contestant");

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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

  const handleExecuteEliminations = async () => {
    try {
      setIsEliminating(true);
      await api.post(`/rounds/${id}/execute-eliminations`, { groupNumber: selectedGroup });

      toast.success(`Eliminations executed successfully.`, {
        description: `Contestants in Group ${selectedGroup} have been processed.`,
        closeButton: true,
      });

      setIsEliminationModalOpen(false);
      fetchData();
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsEliminating(false);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-[#35373C] rounded-full text-[#80848E] hover:text-white transition-colors"
          >
            <ChevronLeft />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Round {round?.roundNumber} Submissions Detail
            </h1>
            <p className="text-[#80848E] text-sm mt-1">Staff / Admin View</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || Object.keys(editedSubs).length === 0}
          className="min-w-47.5 justify-center tabular-nums bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-md font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes {Object.keys(editedSubs).length > 0 && `(${Object.keys(editedSubs).length})`}
        </button>
      </div>

      {/* Controls Bar */}
      <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-[#80848E] uppercase">Group:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(Number(e.target.value))}
              className="bg-[#1E1F22] text-white text-sm rounded border border-[#35373C] px-3 py-1.5 outline-none focus:border-[#5865F2]"
            >
              {Array.from({ length: round?.groupCount || 1 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Group {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="flex bg-[#1E1F22] rounded-lg p-1 border border-[#35373C]">
            <button
              onClick={() => setViewMode("contestant")}
              className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-2 ${viewMode === "contestant" ? "bg-[#5865F2] text-white font-bold" : "text-[#80848E] hover:text-white"}`}
            >
              <Users className="w-4 h-4" /> By Contestant
            </button>
            <button
              onClick={() => setViewMode("judge")}
              className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-2 ${viewMode === "judge" ? "bg-[#5865F2] text-white font-bold" : "text-[#80848E] hover:text-white"}`}
            >
              <Gavel className="w-4 h-4" /> By Judge
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsEliminationModalOpen(true)}
          disabled={!canExecuteElimination || isEliminating}
          className={`px-4 py-2 tabular-nums rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${canExecuteElimination ? "bg-red-500 hover:bg-red-600 text-white" : "bg-[#35373C] text-[#80848E] cursor-not-allowed"}`}
        >
          {isEliminating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Skull className="w-4 h-4" />
          )}
          Execute Eliminations (G{selectedGroup})
        </button>
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
                className={`w-full px-5 py-4 flex justify-between items-center transition-colors ${
                  hasMissingSubs
                    ? "bg-red-500/5 hover:bg-red-500/10"
                    : "bg-[#1E1F22]/30 hover:bg-[#1E1F22]/80"
                } ${isExpanded ? "border-b border-[#1E1F22]" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {viewMode === "contestant" ? (
                      <Users className="w-5 h-5 text-[#5865F2]" />
                    ) : (
                      <Gavel className="w-5 h-5 text-yellow-500" />
                    )}
                    {group.name}
                  </h2>

                  {/* Badges and counters */}
                  <div className="flex items-center gap-2">
                    <span className="bg-[#2B2D31] border border-[#35373C] text-[#80848E] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                      {group.subs.length} Track{group.subs.length !== 1 && "s"}
                    </span>
                    {hasMissingSubs && (
                      <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                        <AlertCircle className="w-3 h-3" /> Missing Submissions
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand/Collapse Icon */}
                <div
                  className={`p-1 rounded-full transition-all duration-200 ${isExpanded ? "bg-[#5865F2]/20 text-[#5865F2]" : "text-[#80848E]"}`}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
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

      {/* Elimination Confirmation Modal */}
      {isEliminationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Skull className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Execute Eliminations</h2>
              <p className="text-[#80848E] text-sm">
                Are you sure you want to execute eliminations for{" "}
                <strong className="text-[#DBDEE1]">Group {selectedGroup}</strong>?
              </p>
              <p className="text-[#80848E] text-xs mt-3 bg-[#1E1F22] p-3 rounded border border-[#35373C]">
                This will recalculate statuses for all users in this group (DID_NOT_SUBMIT,
                ELIMINATED, or ACTIVE). This action may be executed again later.
              </p>
            </div>

            <div className="bg-[#1E1F22] p-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEliminationModalOpen(false)}
                disabled={isEliminating}
                className="px-4 py-2 text-sm font-medium text-[#DBDEE1] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteEliminations}
                disabled={isEliminating}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEliminating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isEliminating ? "Executing..." : "Confirm Execution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
