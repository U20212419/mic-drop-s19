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
  Settings,
  X,
  Search,
  CheckSquare,
  Loader2,
  UserPlus,
  RefreshCw,
} from "lucide-react";

interface DiscordUser {
  idUser: number;
  discordId: string;
  username: string;
  globalRole: string;
  status: string;
  groupNumber?: number; // Only relevant for contestants to track their group assignment
}

interface Round {
  idRound: number;
  roundNumber: number;
  active: boolean;
  submissionsOpen: boolean;
  groupCount: number;
  eliminationAmount?: number;
}

export default function RoundDetailPage() {
  const { id } = useParams();
  const router = useRouter();

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

  // The group the admin is currently assigning users to
  const [currentGroupSelection, setCurrentGroupSelection] = useState<number>(1);

  // Search filters
  const [contestantSearch, setContestantSearch] = useState("");
  const [judgeSearch, setJudgeSearch] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, [id]);

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
    const selectedIds = selectedJudges.map((j) => j.idUser);
    const contestantIds = selectedContestants.map((p) => p.idUser);
    return allUsers.filter(
      (u) =>
        !selectedIds.includes(u.idUser) &&
        !contestantIds.includes(u.idUser) && // A contestant cannot be a judge
        u.status !== "DID_NOT_SUBMIT" && // Users who did not submit cannot be judges
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
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [selectedJudges, currentGroupSelection]);

  const handleToggleUser = (user: DiscordUser, isContestant: boolean) => {
    const newUser = { ...user, groupNumber: currentGroupSelection };
    if (isContestant) {
      setSelectedContestants((prev) => [...prev, newUser]);
    } else {
      setSelectedJudges((prev) => [...prev, newUser]);
    }
  };

  const handleRemoveUser = (idUser: number, isContestant: boolean) => {
    if (isContestant) {
      setSelectedContestants((prev) => prev.filter((c) => c.idUser !== idUser));
    } else {
      setSelectedJudges((prev) => prev.filter((j) => j.idUser !== idUser));
    }
  };

  const handleSelectAllFiltered = (isContestant: boolean) => {
    const usersToAdd = isContestant ? availableContestants : availableJudges;
    const usersWithGroups = usersToAdd.map((u) => ({ ...u, groupNumber: currentGroupSelection }));

    if (isContestant) {
      // Add all currently filtered available contestants
      setSelectedContestants((prev) => [...prev, ...usersWithGroups]);
    } else {
      // Add all currently filtered available judges
      setSelectedJudges((prev) => [...prev, ...usersWithGroups]);
    }
  };

  const handleAutoAssign = async () => {
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

  const handleActiveToggle = () => {
    if (!round) return;
    const willBeActive = !round.active;

    setRound({
      ...round,
      active: willBeActive,
      submissionsOpen: willBeActive ? round.submissionsOpen : false, // If deactivating, also close submissions
    });
  };

  const handleSubmissionsToggle = () => {
    if (!round) return;

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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (activeTab === "details") {
        await api.put(`/rounds/${id}`, round);
      } else {
        // Sync assignments (Contestants or Judges)
        const payload = {
          contestants: selectedContestants.map((c) => ({
            idUser: c.idUser,
            groupNumber: c.groupNumber || 1, // Default to group 1 if not set, though it should always be set
          })),
          judges: selectedJudges.map((j) => ({
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

  if (isLoading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-[#5865F2]" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-[#35373C] rounded-full text-[#80848E] hover:text-white transition-colors"
          >
            <ChevronLeft />
          </button>
          <h1 className="text-2xl font-bold text-white">
            Round {round?.roundNumber} Configuration
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-md font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Tabs System */}
      <div className="flex border-b border-[#1E1F22]">
        <TabButton
          active={activeTab === "details"}
          onClick={() => setActiveTab("details")}
          icon={<Settings className="w-4 h-4" />}
          label="Details"
        />
        <TabButton
          active={activeTab === "contestants"}
          onClick={() => setActiveTab("contestants")}
          icon={<Users className="w-4 h-4" />}
          label="Contestants"
        />
        <TabButton
          active={activeTab === "judges"}
          onClick={() => setActiveTab("judges")}
          icon={<Gavel className="w-4 h-4" />}
          label="Judges"
        />
      </div>

      {/* Tab Content */}
      <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] p-6">
        {/* Details Tab */}
        {activeTab === "details" && round && (
          <div className="max-w-md space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                  Round Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={round.roundNumber}
                  disabled={round.active} // Prevent changing round number if the round is active
                  onChange={(e) =>
                    setRound({ ...round, roundNumber: Math.max(1, Number(e.target.value)) })
                  }
                  className={
                    round.active
                      ? "w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2] opacity-50 cursor-not-allowed"
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
                  disabled={round.active} // Prevent changing group count if the round is active
                  onChange={(e) =>
                    setRound({ ...round, groupCount: Math.max(1, Number(e.target.value)) })
                  }
                  className={
                    round.active
                      ? "w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2] opacity-50 cursor-not-allowed"
                      : "w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2]"
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                  Elimination Amount
                </label>
                <input
                  type="number"
                  min="0"
                  value={
                    round.eliminationAmount || round.eliminationAmount === 0
                      ? round.eliminationAmount.toString()
                      : ""
                  }
                  onChange={(e) =>
                    setRound({
                      ...round,
                      eliminationAmount:
                        e.target.value || e.target.value === "0"
                          ? Math.max(0, Number(e.target.value))
                          : undefined,
                    })
                  }
                  className="w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2]"
                />
              </div>
            </div>

            <div className="space-y-3">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#1E1F22] rounded-lg border border-[#35373C]">
                <div>
                  <p className="text-white font-medium">Active Round</p>
                  <p className="text-[#80848E] text-sm">
                    Setting this to true will deactivate any other active round.
                  </p>
                </div>
                <button
                  onClick={handleActiveToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${round.active ? "bg-[#5865F2]" : "bg-[#4E5058]"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${round.active ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>

              {/* Submissions Open Toggle */}
              <div
                className={`flex items-center justify-between p-4 bg-[#1E1F22] rounded-lg border border-[#35373C] transition-opacity ${!round.active ? "opacity-50" : ""}`}
              >
                <div>
                  <p className="text-white font-medium">Submissions Open</p>
                  <p className="text-[#80848E] text-sm">
                    Allows contestants to submit their tracks.
                  </p>
                </div>
                <button
                  onClick={handleSubmissionsToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${round.submissionsOpen ? "bg-[#5865F2]" : "bg-[#4E5058]"} ${!round.active && !round.submissionsOpen ? "cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${round.submissionsOpen ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTESTANTS / JUDGES TAB (Dynamic Layout) */}
        {(activeTab === "contestants" || activeTab === "judges") && (
          <div className="space-y-6">
            {/* Global Smart Action Banner (Only for Contestants) */}
            {activeTab === "contestants" && (
              <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-[#DBDEE1] font-bold text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#5865F2]" />
                    Smart Auto-Assign
                  </h3>
                  <p className="text-[#80848E] text-xs mt-1">
                    Automatically populate this round by inheriting the exact group assignments from
                    the previous round for all active contestants.
                  </p>
                </div>
                <button
                  onClick={handleAutoAssign}
                  disabled={isSaving}
                  className="shrink-0 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold px-4 py-2 rounded transition-colors uppercase tracking-wide"
                >
                  Execute Auto-Assign
                </button>
              </div>
            )}

            {/* Manual Assignment: Target Group */}
            <div className="flex items-center gap-3 p-4 bg-[#1E1F22] rounded-lg border border-[#35373C]">
              <label className="text-sm font-bold text-white">
                Manual Assignment - Target Group:
              </label>
              <select
                value={currentGroupSelection}
                onChange={(e) => setCurrentGroupSelection(Number(e.target.value))}
                className="bg-[#2B2D31] text-white text-sm rounded border border-[#35373C] px-3 py-1.5 outline-none focus:border-[#5865F2]"
              >
                {Array.from({ length: round?.groupCount || 1 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Group {i + 1}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#80848E] ml-2 hidden sm:inline">
                Users selected below will be added to this specific group.
              </span>
            </div>

            {/* Tag Cloud (Selected Users) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#80848E] uppercase">
                <label>
                  Selected {activeTab === "contestants" ? "Contestants" : "Judges"} - Group{" "}
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
                  (user) => (
                    <span
                      key={user.idUser}
                      className="inline-flex items-center bg-[#35373C] text-[#DBDEE1] pl-2 pr-1 py-1 rounded text-sm gap-2"
                    >
                      {user.username}
                      <button
                        onClick={() => handleRemoveUser(user.idUser, activeTab === "contestants")}
                        className="hover:text-red-400 hover:bg-red-400/10 rounded p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ),
                )}
                {(activeTab === "contestants" ? currentGroupContestants : currentGroupJudges)
                  .length === 0 && (
                  <p className="text-[#4E5058] text-sm italic">
                    No users assigned to Group {currentGroupSelection} yet...
                  </p>
                )}
              </div>
            </div>

            {/* Selection List */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
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
                    className="w-full bg-[#1E1F22] border-none text-white rounded-md pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-[#5865F2]"
                  />
                </div>
                <button
                  onClick={() => handleSelectAllFiltered(activeTab === "contestants")}
                  className="text-sm text-[#5865F2] hover:underline flex items-center gap-1 font-medium"
                >
                  <CheckSquare className="w-4 h-4" /> Select All Filtered (to G
                  {currentGroupSelection})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-100 overflow-y-auto pr-2 custom-scrollbar">
                {(activeTab === "contestants" ? availableContestants : availableJudges).map(
                  (user) => (
                    <div
                      key={user.idUser}
                      onClick={() => handleToggleUser(user, activeTab === "contestants")}
                      className="flex items-center justify-between p-3 bg-[#232428] hover:bg-[#35373C] border border-[#1E1F22] rounded-lg cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2] text-xs font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-[#DBDEE1]">{user.username}</span>
                      </div>
                      <UserPlus className="w-4 h-4 text-[#4E5058] group-hover:text-[#5865F2] transition-colors" />
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
      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative ${
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
