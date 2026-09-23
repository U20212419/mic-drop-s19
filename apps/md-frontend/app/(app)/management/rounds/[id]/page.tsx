"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import api from "@/lib/axios";
import {
  ChevronLeft,
  Save,
  Users,
  Gavel,
  Settings,
  X,
  Search,
  CheckSquare,
  Loader2,
  UserPlus,
  RefreshCw,
  Shuffle,
  Star,
  FileText,
} from "lucide-react";
import FormattedText from "@/components/FormattedText";

interface DiscordUser {
  idUser: number;
  discordId: string;
  username: string;
  globalRole: string;
  status: string;
  groupNumber?: number; // Only relevant for contestants to track their group assignment
  judgeApp?: any; // Field to validate if a user has submitted a judge application
  sortOrder?: number; // Only relevant for judges to track their order within a group
}

interface Round {
  idRound: number;
  roundNumber: number;
  active: boolean;
  submissionsOpen: boolean;
  groupCount: number;
  eliminationAmount?: string;
  specialRound?: boolean;
}

export default function RoundDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "USER";
  const isAdmin = userRole === "ADMIN";

  // UI state
  const [activeTab, setActiveTab] = useState<"details" | "contestants" | "judges">("details");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Data state
  const [round, setRound] = useState<Round | null>(null);
  const [allUsers, setAllUsers] = useState<DiscordUser[]>([]);

  // Selection states
  const [selectedContestants, setSelectedContestants] = useState<DiscordUser[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<DiscordUser[]>([]);

  // The group the admin/staff is currently viewing/assigning users to
  const [currentGroupSelection, setCurrentGroupSelection] = useState<number>(1);

  // Search filters
  const [contestantSearch, setContestantSearch] = useState("");
  const [judgeSearch, setJudgeSearch] = useState("");

  // Judge app modal states
  const [isJudgeAppModalOpen, setIsJudgeAppModalOpen] = useState<boolean>(false);
  const [isLoadingJudgeApp, setIsLoadingJudgeApp] = useState<boolean>(false);
  const [selectedJudgeApp, setSelectedJudgeApp] = useState<any>(null);
  const [selectedJudgeName, setSelectedJudgeName] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  useEffect(() => {
    setContestantSearch("");
    setJudgeSearch("");
  }, [currentGroupSelection, activeTab]);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      // Fetch round info, all users, and current assigned contestants/judges
      const [roundRes, usersRes, assignmentsRes] = await Promise.all([
        api.get(`/rounds/${id}`),
        api.get("/users"),
        api.get(`/rounds/${id}/assignments`), // Endpoint that returns { contestants: [], judges: [] }
      ]);

      setRound(roundRes.data);
      setAllUsers(usersRes.data);
      setSelectedContestants(assignmentsRes.data.contestants);
      setSelectedJudges(assignmentsRes.data.judges);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  // Alphabetically sorted tags
  const sortedContestantTags = useMemo(
    () => [...selectedContestants].sort((a, b) => a.username.localeCompare(b.username)),
    [selectedContestants],
  );

  const sortedJudgeTags = useMemo(
    () => [...selectedJudges].sort((a, b) => a.username.localeCompare(b.username)),
    [selectedJudges],
  );

  // Available users for contestants (only status 'ACTIVE' and not already selected)
  const availableContestants = useMemo(() => {
    const selectedIds = selectedContestants.map((p) => p.idUser);
    return allUsers.filter(
      (u) =>
        u.status === "ACTIVE" &&
        !selectedIds.includes(u.idUser) &&
        u.username.toLowerCase().includes(contestantSearch.toLowerCase()),
    );
  }, [allUsers, selectedContestants, contestantSearch]);

  // Available users for judges (not selected and not an active contestant)
  const availableJudges = useMemo(() => {
    const selectedIdsInCurrentGroup = selectedJudges
      .filter((j) => (j.groupNumber || 1) === currentGroupSelection)
      .map((j) => j.idUser);
    const contestantIds = selectedContestants.map((p) => p.idUser);
    return allUsers.filter(
      (u) =>
        !contestantIds.includes(u.idUser) && // A contestant cannot be a judge
        u.status !== "DID_NOT_SUBMIT" && // Users who did not submit cannot be judges
        u.judgeApp && // Only include users who have submitted a judge application
        !selectedIdsInCurrentGroup.includes(u.idUser) && // Not already selected as a judge in the current group
        u.username.toLowerCase().includes(judgeSearch.toLowerCase()),
    );
  }, [allUsers, selectedJudges, selectedContestants, judgeSearch]);

  // Selected users specifically for the current group selection
  const currentGroupContestants = useMemo(() => {
    return selectedContestants
      .filter((c) => (c.groupNumber || 1) === currentGroupSelection)
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [selectedContestants, currentGroupSelection]);

  const currentGroupJudges = useMemo(() => {
    return selectedJudges
      .filter((j) => (j.groupNumber || 1) === currentGroupSelection)
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  }, [selectedJudges, currentGroupSelection]);

  const handleToggleUser = (user: DiscordUser, isContestant: boolean) => {
    if (!isAdmin) return;
    if (isContestant) {
      const newUser = { ...user, groupNumber: currentGroupSelection };
      setSelectedContestants((prev) => [...prev, newUser]);
    } else {
      setSelectedJudges((prev) => {
        const groupUsers = prev.filter((j) => (j.groupNumber || 1) === currentGroupSelection);
        // Find the highest sortOrder in the current group and add 1
        const nextSortOrder =
          groupUsers.length > 0 ? Math.max(...groupUsers.map((u) => u.sortOrder ?? 0)) + 1 : 0;

        const newUser = { ...user, groupNumber: currentGroupSelection, sortOrder: nextSortOrder };
        return [...prev, newUser];
      });
    }
  };

  const moveUserOrder = (idUser: number, direction: -1 | 1, isContestant: boolean) => {
    if (!isAdmin) return;

    const setter = isContestant ? setSelectedContestants : setSelectedJudges;

    setter((prev) => {
      const groupUsers = prev.filter((u) => (u.groupNumber || 1) === currentGroupSelection);
      groupUsers.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

      const currentIndexInGroup = groupUsers.findIndex((u) => u.idUser === idUser);

      if (currentIndexInGroup < 0) return prev;
      const targetIndexInGroup = currentIndexInGroup + direction;

      // Avoid overflowing the bounds of the group
      if (targetIndexInGroup < 0 || targetIndexInGroup >= groupUsers.length) return prev;

      const targetIdUser = groupUsers[targetIndexInGroup].idUser;

      // Find the absolute indexes in the original array, filtered by the current group selection
      const absoluteCurrentIndex = prev.findIndex(
        (u) => u.idUser === idUser && (u.groupNumber || 1) === currentGroupSelection,
      );
      const absoluteTargetIndex = prev.findIndex(
        (u) => u.idUser === targetIdUser && (u.groupNumber || 1) === currentGroupSelection,
      );

      // Swap positions
      const newArr = [...prev];
      const userA = { ...newArr[absoluteCurrentIndex] };
      const userB = { ...newArr[absoluteTargetIndex] };

      const tempOrder = userA.sortOrder ?? currentIndexInGroup;
      userA.sortOrder = userB.sortOrder ?? targetIndexInGroup;
      userB.sortOrder = tempOrder;

      newArr[absoluteCurrentIndex] = userB;
      newArr[absoluteTargetIndex] = userA;

      return newArr;
    });
  };

  const handleRemoveUser = (idUser: number, isContestant: boolean) => {
    if (!isAdmin) return;
    if (isContestant) {
      setSelectedContestants((prev) => prev.filter((c) => c.idUser !== idUser));
    } else {
      setSelectedJudges((prev) =>
        prev.filter(
          (j) => !(j.idUser === idUser && (j.groupNumber || 1) === currentGroupSelection),
        ),
      );
    }
  };

  const handleSelectAllFiltered = (isContestant: boolean) => {
    if (!isAdmin) return;

    if (isContestant) {
      const usersWithGroups = availableContestants.map((u) => ({
        ...u,
        groupNumber: currentGroupSelection,
      }));
      // Add all currently filtered available contestants
      setSelectedContestants((prev) => [...prev, ...usersWithGroups]);
    } else {
      setSelectedJudges((prev) => {
        const groupUsers = prev.filter((j) => (j.groupNumber || 1) === currentGroupSelection);
        let nextSortOrder =
          groupUsers.length > 0 ? Math.max(...groupUsers.map((u) => u.sortOrder ?? 0)) + 1 : 0;

        const usersWithGroups = availableJudges.map((u) => {
          const userObj = { ...u, groupNumber: currentGroupSelection, sortOrder: nextSortOrder };
          nextSortOrder++;
          return userObj;
        });

        return [...prev, ...usersWithGroups];
      });
    }
  };

  const handleAutoAssign = async () => {
    if (!isAdmin) return;
    try {
      setIsSaving(true);
      const res = await api.post(`/rounds/${id}/auto-assign-contestants`);
      setSelectedContestants(res.data.contestants);

      toast.success("Auto-assignment completed successfully.", {
        description: `Contestants have been automatically assigned for round ${round?.roundNumber} based on groups from the previous round.`,
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandomAssign = async () => {
    if (!isAdmin) return;
    try {
      setIsSaving(true);
      const res = await api.post(`/rounds/${id}/randomly-assign-contestants`);
      setSelectedContestants(res.data.contestants);

      toast.success("Random assignment completed successfully.", {
        description: `Active contestants were distributed randomly and evenly across the ${round?.groupCount} groups for round ${round?.roundNumber}.`,
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSaving(false);
    }
  };

  const handleActiveToggle = () => {
    if (!round || !isAdmin) return;
    const willBeActive = !round.active;

    setRound({
      ...round,
      active: willBeActive,
      submissionsOpen: willBeActive ? round.submissionsOpen : false,
    });
  };

  const handleSubmissionsToggle = () => {
    if (!round || !isAdmin) return;

    if (!round.active && !round.submissionsOpen) {
      toast.error("Cannot open submissions for an inactive round.", {
        description: "Please activate the round before opening submissions.",
        closeButton: true,
      });
      return;
    }

    setRound({
      ...round,
      submissionsOpen: !round.submissionsOpen,
    });
  };

  const handleSpecialRoundToggle = () => {
    if (!round || !isAdmin) return;

    // Prevent changing roundd type if submissions are open
    if (round.submissionsOpen) {
      toast.error("Cannot change round type while submissions are open.", {
        description: "Please close submissions before changing the round type.",
        closeButton: true,
      });
      return;
    }

    setRound({
      ...round,
      specialRound: !round.specialRound,
    });
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    try {
      setIsSaving(true);
      if (activeTab === "details") {
        await api.put(`/rounds/${id}`, round);
      } else {
        // Enforce sortOrder before sending the payload so the backend maps it sequentially
        const sortedSelectedJudges = [...selectedJudges].sort(
          (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
        );

        // Sync assignments (Contestants or Judges)
        const payload = {
          contestants: selectedContestants.map((c) => ({
            idUser: c.idUser,
            groupNumber: c.groupNumber || 1, // Default to group 1 if not set, though it should always be set
          })),
          judges: sortedSelectedJudges.map((j) => ({
            idUser: j.idUser,
            groupNumber: j.groupNumber || 1, // Default to group 1 if not set, though it should always be set
          })),
        };

        const res = await api.put(`/rounds/${id}/assignments`, payload);

        // Update local state with response to reflect any changes made by the backend
        setSelectedContestants(res.data.contestants);
        setSelectedJudges(res.data.judges);
      }

      toast.success("Configuration saved successfully.", {
        description: `The round ${round?.roundNumber} configuration has been updated.`,
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewJudgeApp = async (e: React.MouseEvent, user: any) => {
    e.stopPropagation(); // Prevent triggering the user selection toggle
    setSelectedJudgeName(user.username);
    setIsLoadingJudgeApp(true);
    setIsJudgeAppModalOpen(true);
    setSelectedJudgeApp(null); // Reset previous app data

    const fullUser = allUsers.find((u) => u.idUser === user.idUser) || user;

    try {
      const res = await api.get(`/judge-apps/user/${fullUser.discordId}`);
      if (res.status === 200 && res.data) {
        setSelectedJudgeApp(res.data);
      }
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsLoadingJudgeApp(false);
    }
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5865F2] hover:underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-[#5865F2]" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => router.back()}
            className="p-1.5 sm:p-2 -ml-1.5 sm:ml-0 hover:bg-[#35373C] rounded-full text-[#80848E] hover:text-white transition-colors shrink-0 flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex flex-wrap items-center gap-2 leading-tight">
            Round {round?.roundNumber} Configuration
            {round?.specialRound && (
              <span className="bg-[#E67E22]/10 text-[#E67E22] border border-[#E67E22]/30 text-[10px] sm:text-xs font-black px-2 sm:px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Star className="w-3 h-3 shrink-0" /> Special
              </span>
            )}
            {!isAdmin && (
              <span className="bg-[#35373C] text-[#DBDEE1] text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                Read Only
              </span>
            )}
          </h1>
        </div>

        {/* Only ADMINs see the save button */}
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2.5 sm:py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            Save Changes
          </button>
        )}
      </div>

      {/* Tabs System */}
      <div className="flex overflow-x-auto custom-scrollbar border-b border-[#1E1F22]">
        <TabButton
          active={activeTab === "details"}
          onClick={() => setActiveTab("details")}
          icon={<Settings className="w-4 h-4 shrink-0" />}
          label="Details"
        />
        <TabButton
          active={activeTab === "contestants"}
          onClick={() => setActiveTab("contestants")}
          icon={<Users className="w-4 h-4 shrink-0" />}
          label="Contestants"
        />
        <TabButton
          active={activeTab === "judges"}
          onClick={() => setActiveTab("judges")}
          icon={<Gavel className="w-4 h-4 shrink-0" />}
          label="Judges"
        />
      </div>

      {/* Tab Content */}
      <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] p-6">
        {/* Details Tab */}
        {activeTab === "details" && round && (
          <div className="max-w-xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                  Round Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={round.roundNumber}
                  disabled={!isAdmin || round.active}
                  onChange={(e) =>
                    setRound({ ...round, roundNumber: Math.max(1, Number(e.target.value)) })
                  }
                  className={
                    !isAdmin || round.active
                      ? "w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none opacity-50 cursor-not-allowed"
                      : "w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2]"
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                  Total Groups
                </label>
                <input
                  type="number"
                  min="1"
                  value={round.groupCount}
                  disabled={!isAdmin || round.active}
                  onChange={(e) =>
                    setRound({ ...round, groupCount: Math.max(1, Number(e.target.value)) })
                  }
                  className={
                    !isAdmin || round.active
                      ? "w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none opacity-50 cursor-not-allowed"
                      : "w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2]"
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                  Elimination Amount (Per Group)
                </label>

                {/* Dynamic Grid based on groupCount */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: round.groupCount || 1 }).map((_, i) => {
                    const elimString =
                      round.eliminationAmount !== null && round.eliminationAmount !== undefined
                        ? String(round.eliminationAmount)
                        : "";
                    const elimArray = elimString.split(",");

                    // Allow empty values so the backend validation catches it if forgotten
                    const currentVal = elimArray[i]?.trim() ?? "";

                    return (
                      <div
                        key={i}
                        className={`flex items-center rounded-md border transition-colors ${
                          !isAdmin
                            ? "bg-[#1E1F22] border-[#1E1F22] opacity-50 cursor-not-allowed"
                            : "bg-[#1E1F22] border-[#35373C] focus-within:border-[#5865F2]"
                        }`}
                      >
                        <span className="bg-[#2B2D31] text-[#80848E] text-xs font-bold px-3 py-2 border-r border-[#35373C] rounded-l-md shrink-0">
                          G{i + 1}
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={!isAdmin}
                          value={currentVal}
                          onKeyDown={(e) => {
                            // Block decimal points, commas, minus, plus, and 'e' (scientific notation)
                            if (["-", "+", "e", "E", ".", ","].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const newArray = [...elimArray];

                            // Pad the array with empty strings if it's currently shorter than groupCount
                            while (newArray.length < round.groupCount) {
                              newArray.push("");
                            }

                            const val = e.target.value;

                            // Allow empty string, otherwise parse strictly as a base-10 integer
                            newArray[i] =
                              val === "" ? "" : Math.max(0, parseInt(val, 10)).toString();

                            setRound({
                              ...round,
                              eliminationAmount: newArray.slice(0, round.groupCount).join(","),
                            });
                          }}
                          className="w-full bg-transparent text-white px-3 py-2 outline-none text-sm min-w-0"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[#80848E] text-[10px] mt-2">
                  Specify the exact number of contestants to eliminate for each individual group.
                  Must be configured before calculating statuses.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Active Toggle */}
              <div className="flex items-start sm:items-center justify-between gap-4 p-4 bg-[#1E1F22] rounded-lg border border-[#35373C]">
                <div className="flex-1">
                  <p className="text-white font-medium">Active Round</p>
                  <p className="text-[#80848E] text-xs sm:text-sm mt-1 sm:mt-0 leading-snug">
                    Setting this to true will deactivate any other active round.
                  </p>
                </div>
                <button
                  onClick={handleActiveToggle}
                  disabled={!isAdmin}
                  className={`shrink-0 mt-1 sm:mt-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!isAdmin ? "cursor-not-allowed opacity-50" : ""} ${round.active ? "bg-[#5865F2]" : "bg-[#4E5058]"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${round.active ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>

              {/* Submissions Open Toggle */}
              <div
                className={`flex items-start sm:items-center justify-between gap-4 p-4 bg-[#1E1F22] rounded-lg border border-[#35373C] transition-opacity ${!round.active ? "opacity-50" : ""}`}
              >
                <div className="flex-1">
                  <p className="text-white font-medium">Submissions Open</p>
                  <p className="text-[#80848E] text-xs sm:text-sm mt-1 sm:mt-0 leading-snug">
                    Allows contestants to submit their tracks.
                  </p>
                </div>
                <button
                  onClick={handleSubmissionsToggle}
                  disabled={!isAdmin || (!round.active && !round.submissionsOpen)}
                  className={`shrink-0 mt-1 sm:mt-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!isAdmin || (!round.active && !round.submissionsOpen) ? "cursor-not-allowed opacity-50" : ""} ${round.submissionsOpen ? "bg-[#5865F2]" : "bg-[#4E5058]"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${round.submissionsOpen ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>

              {/* Special Round Toggle */}
              <div
                className={`flex items-start sm:items-center justify-between gap-4 p-4 bg-[#1E1F22] rounded-lg border border-[#35373C] transition-opacity ${round.submissionsOpen ? "opacity-50" : ""}`}
              >
                <div className="flex-1">
                  <p className="text-white font-medium flex items-center gap-2">
                    Special Round <Star className="w-4 h-4 text-[#E67E22] shrink-0" />
                  </p>
                  <p className="text-[#80848E] text-xs sm:text-sm mt-1 sm:mt-0 leading-snug">
                    Forces contestants to select tracks from their Collection.
                  </p>
                </div>
                <button
                  onClick={handleSpecialRoundToggle}
                  disabled={!isAdmin || round.submissionsOpen}
                  className={`shrink-0 mt-1 sm:mt-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!isAdmin || round.submissionsOpen ? "cursor-not-allowed opacity-50" : ""} ${round.specialRound ? "bg-[#E67E22]" : "bg-[#4E5058]"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${round.specialRound ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTESTANTS / JUDGES TAB (Dynamic Layout) */}
        {(activeTab === "contestants" || activeTab === "judges") && (
          <div className="space-y-6">
            {/* Global Smart Action Banner (Only for ADMIN in Contestants tab) */}
            {isAdmin && activeTab === "contestants" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[#DBDEE1] font-bold text-sm flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-[#5865F2]" />
                      Random Auto-Assign
                    </h3>
                    <p className="text-[#80848E] text-xs mt-1">
                      Randomly distribute all active contestants as evenly as possible across this
                      round&apos;s groups. Existing contestant groups will be replaced.
                    </p>
                  </div>
                  <button
                    onClick={handleRandomAssign}
                    disabled={isSaving || round?.active}
                    className="shrink-0 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold px-4 py-2 rounded transition-colors uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Assign Randomly
                  </button>
                </div>

                <div className="bg-[#2B2D31] border border-[#35373C] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[#DBDEE1] font-bold text-sm flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-[#80848E]" />
                      Inherit Previous Groups
                    </h3>
                    <p className="text-[#80848E] text-xs mt-1">
                      Populate this round using the previous round&apos;s group assignments for all
                      active contestants.
                    </p>
                  </div>
                  <button
                    onClick={handleAutoAssign}
                    disabled={isSaving || round?.active}
                    className="shrink-0 bg-[#4E5058] hover:bg-[#5C5E66] text-white text-xs font-bold px-4 py-2 rounded transition-colors uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Inherit Groups
                  </button>
                </div>
              </div>
            )}

            {/* Target Group View / Selector */}
            <div className="flex flex-col gap-3 p-4 bg-[#1E1F22] rounded-lg border border-[#35373C]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-sm font-bold text-white shrink-0">
                  {isAdmin ? "Manual Assignment - Target Group:" : "Filter View by Group:"}
                </label>
                <select
                  value={currentGroupSelection}
                  onChange={(e) => setCurrentGroupSelection(Number(e.target.value))}
                  className="w-full sm:w-auto bg-[#2B2D31] text-white text-sm rounded border border-[#35373C] px-3 py-2 sm:py-1.5 outline-none focus:border-[#5865F2]"
                >
                  {Array.from({ length: round?.groupCount || 1 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Group {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <span className="text-xs text-[#80848E] leading-relaxed">
                  Users selected below will be added to this specific group.
                </span>
              )}
            </div>

            {/* Tag Cloud (Selected Users) */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-4 text-xs font-bold text-[#80848E] uppercase">
                <label>
                  {isAdmin ? "Selected " : "Assigned "}
                  {activeTab === "contestants" ? "Contestants" : "Judges"} - Group{" "}
                  {currentGroupSelection}
                </label>
                <span>
                  {
                    (activeTab === "contestants" ? currentGroupContestants : currentGroupJudges)
                      .length
                  }{" "}
                  in Group /{" "}
                  {(activeTab === "contestants" ? selectedContestants : selectedJudges).length}{" "}
                  total
                </span>
              </div>

              <div className="flex flex-wrap gap-2 p-3 min-h-12 bg-[#1E1F22] rounded-lg border border-[#1E1F22]">
                {(activeTab === "contestants" ? currentGroupContestants : currentGroupJudges).map(
                  (user, index, array) => {
                    const hasTrailingIcons = isAdmin || activeTab === "judges";

                    return (
                      <span
                        key={user.idUser}
                        className={`inline-flex items-center bg-[#35373C] text-[#DBDEE1] py-1 rounded text-sm gap-2 pl-2 ${
                          hasTrailingIcons ? "pr-1" : "pr-2"
                        }`}
                      >
                        {isAdmin && activeTab === "judges" && (
                          <div className="flex items-center gap-0.5 mr-1 border-r border-[#4E5058] pr-1.5">
                            <button
                              onClick={() => moveUserOrder(user.idUser, -1, false)}
                              disabled={index === 0}
                              className="text-[#80848E] hover:text-[#DBDEE1] disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveUserOrder(user.idUser, 1, false)}
                              disabled={index === array.length - 1}
                              className="text-[#80848E] hover:text-[#DBDEE1] disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                            </button>
                          </div>
                        )}

                        {activeTab === "judges" && (
                          <span className="text-[10px] bg-[#1E1F22] text-[#80848E] px-1.5 py-0.5 rounded font-mono">
                            {index + 1}
                          </span>
                        )}

                        {user.username}

                        {activeTab === "judges" && (
                          <button
                            onClick={(e) => handleViewJudgeApp(e, user)}
                            className="hover:text-[#5865F2] hover:bg-[#5865F2]/20 rounded p-1 transition-colors ml-1"
                            title="View Judge App"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() =>
                              handleRemoveUser(user.idUser, activeTab === "contestants")
                            }
                            className="hover:text-red-400 hover:bg-red-400/10 rounded p-0.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    );
                  },
                )}
                {(activeTab === "contestants" ? currentGroupContestants : currentGroupJudges)
                  .length === 0 && (
                  <p className="text-[#4E5058] text-sm italic">
                    No users assigned to Group {currentGroupSelection} yet...
                  </p>
                )}
              </div>
            </div>

            {/* Selection List (Visible to all, but actions restricted to ADMINs) */}
            <div className="space-y-4 pt-4 border-t border-[#35373C]">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
                  <input
                    type="text"
                    placeholder="Search available users..."
                    value={activeTab === "contestants" ? contestantSearch : judgeSearch}
                    onChange={(e) =>
                      activeTab === "contestants"
                        ? setContestantSearch(e.target.value)
                        : setJudgeSearch(e.target.value)
                    }
                    className="w-full bg-[#1E1F22] border-none text-white rounded-md pl-10 pr-4 py-2.5 sm:py-2 outline-none focus:ring-1 focus:ring-[#5865F2]"
                  />
                </div>

                {/* Only ADMINs can select all filtered users */}
                {isAdmin && (
                  <button
                    onClick={() => handleSelectAllFiltered(activeTab === "contestants")}
                    className="w-full sm:w-auto text-sm bg-[#35373C] sm:bg-transparent text-[#DBDEE1] sm:text-[#5865F2] hover:bg-[#4E5058] sm:hover:bg-transparent sm:hover:underline py-2.5 sm:py-0 rounded-md sm:rounded-none flex items-center justify-center gap-2 font-medium transition-colors shrink-0"
                  >
                    <CheckSquare className="w-4 h-4" /> Select All Filtered (to G
                    {currentGroupSelection})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-100 overflow-y-auto pr-2 custom-scrollbar">
                {(activeTab === "contestants" ? availableContestants : availableJudges).map(
                  (user) => (
                    <div
                      key={user.idUser}
                      onClick={() => isAdmin && handleToggleUser(user, activeTab === "contestants")}
                      className={`flex items-center justify-between p-3 bg-[#232428] border border-[#1E1F22] rounded-lg transition-colors group ${
                        isAdmin ? "hover:bg-[#35373C] cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2] text-xs font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-[#DBDEE1]">{user.username}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {activeTab === "judges" && (
                          <button
                            onClick={(e) => handleViewJudgeApp(e, user)}
                            className="p-1.5 text-[#80848E] hover:text-[#DBDEE1] hover:bg-[#4E5058] rounded transition-colors relative z-10"
                            title="View Judge App"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        {/* Only ADMINs see the "Add" icon */}
                        {isAdmin && (
                          <UserPlus className="w-4 h-4 text-[#4E5058] group-hover:text-[#5865F2] transition-colors" />
                        )}
                      </div>
                    </div>
                  ),
                )}
                {(activeTab === "contestants" ? availableContestants : availableJudges).length ===
                  0 && (
                  <p className="col-span-full text-center py-10 text-[#80848E]">
                    No more users available to add.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Judge App Modal */}
      {isJudgeAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#313338] border border-[#1E1F22] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#1E1F22] p-5 border-b border-[#35373C] flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-[#5865F2]" />
                Judge App: <span className="text-[#5865F2]">{selectedJudgeName}</span>
              </h2>
              <button
                onClick={() => setIsJudgeAppModalOpen(false)}
                className="p-1 text-[#80848E] hover:text-[#DBDEE1] hover:bg-[#35373C] rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {isLoadingJudgeApp ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
                  <p className="text-[#80848E] text-sm font-medium">Loading application...</p>
                </div>
              ) : selectedJudgeApp ? (
                <div className="space-y-6">
                  {/* Helper function to render each field */}
                  {[
                    { label: "Favourite Artists", val: selectedJudgeApp.favArtists },
                    { label: "Least Favourite Artists", val: selectedJudgeApp.leastFavArtists },
                    { label: "Favourite Genres", val: selectedJudgeApp.favGenres },
                    { label: "Least Favourite Genres", val: selectedJudgeApp.leastFavGenres },
                    { label: "Banned Artists", val: selectedJudgeApp.bannedArtists },
                    { label: "Judging Style", val: selectedJudgeApp.judgingStyle },
                    { label: "Safe Pick Criteria", val: selectedJudgeApp.safePickCriteria },
                  ].map((field, idx) => (
                    <div key={idx} className="bg-[#2B2D31] border border-[#1E1F22] rounded-md p-4">
                      <label className="text-xs font-bold text-[#80848E] uppercase tracking-wide mb-2 block">
                        {field.label}
                      </label>
                      <div className="text-[#DBDEE1] text-sm whitespace-pre-wrap leading-relaxed wrap-anywhere">
                        {field.val ? (
                          <FormattedText text={field.val} />
                        ) : (
                          <span className="text-[#4E5058] italic">Not provided</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Preferences */}
                  <div className="bg-[#1E1F22] p-4 rounded-lg border border-[#35373C] flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#80848E] uppercase tracking-wide">
                        Preferred Judging Workload
                      </label>
                      <p className="text-[#DBDEE1] text-sm mt-1 font-medium bg-[#2B2D31] px-3 py-2 rounded border border-[#1E1F22]">
                        {selectedJudgeApp.amountPreference === "MORE"
                          ? "Prefers judging MORE tracks"
                          : selectedJudgeApp.amountPreference === "LESS"
                            ? "Prefers judging LESS tracks"
                            : "No preference"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#80848E] uppercase tracking-wide">
                        Giving Bonus Points
                      </label>
                      <p className="text-[#DBDEE1] text-sm mt-1 font-medium bg-[#2B2D31] px-3 py-2 rounded border border-[#1E1F22]">
                        {selectedJudgeApp.givingBonus ? "Yes (+0.25 to unheard tracks)" : "No"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-[#2B2D31] rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-[#4E5058]" />
                  </div>
                  <p className="text-[#DBDEE1] font-bold">No application found</p>
                  <p className="text-[#80848E] text-sm mt-1">
                    This user hasn't submitted a judge application yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 sm:px-6 py-4 text-sm font-medium transition-all relative whitespace-nowrap shrink-0 ${
        active ? "text-white" : "text-[#80848E] hover:text-[#DBDEE1]"
      }`}
    >
      {icon}
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5865F2] rounded-t-full" />
      )}
    </button>
  );
}
