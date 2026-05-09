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
} from "lucide-react";

interface DiscordUser {
  idUser: number;
  discordId: string;
  username: string;
  globalRole: string;
  status: string;
}

interface Round {
  idRound: number;
  roundNumber: number;
  active: boolean;
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
        u.username.toLowerCase().includes(judgeSearch.toLowerCase()),
    );
  }, [allUsers, selectedJudges, selectedContestants, judgeSearch]);

  const handleToggleContestant = (user: DiscordUser) => {
    setSelectedContestants((prev) => [...prev, user]);
  };

  const handleRemoveContestant = (idUser: number) => {
    setSelectedContestants((prev) => prev.filter((p) => p.idUser !== idUser));
  };

  const handleSelectAllContestants = () => {
    // Add all currently filtered available contestants
    setSelectedContestants((prev) => [...prev, ...availableContestants]);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (activeTab === "details") {
        await api.put(`/rounds/${id}`, round);
      } else {
        // Sync assignments (Contestants or Judges)
        const payload = {
          contestants: selectedContestants.map((p) => p.idUser),
          judges: selectedJudges.map((j) => j.idUser),
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
          className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-md font-medium flex items-center gap-2 transition-all disabled:opacity-50"
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
        {/* DETAILS TAB */}
        {activeTab === "details" && round && (
          <div className="max-w-md space-y-6">
            <div>
              <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                Round Number
              </label>
              <input
                type="number"
                value={round.roundNumber}
                onChange={(e) => setRound({ ...round, roundNumber: Number(e.target.value) })}
                className="w-full bg-[#1E1F22] border border-[#1E1F22] text-white rounded-md px-3 py-2 outline-none focus:border-[#5865F2] transition-all"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-[#1E1F22] rounded-lg">
              <div>
                <p className="text-white font-medium">Active Round</p>
                <p className="text-[#80848E] text-sm">
                  Setting this to true will deactivate any other active round.
                </p>
              </div>
              <button
                onClick={() => setRound({ ...round, active: !round.active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${round.active ? "bg-[#5865F2]" : "bg-[#4E5058]"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${round.active ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>
        )}

        {/* CONTESTANTS / JUDGES TAB (Dynamic Layout) */}
        {(activeTab === "contestants" || activeTab === "judges") && (
          <div className="space-y-6">
            {/* Tag Cloud (Selected Users) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#80848E] uppercase">
                Selected {activeTab === "contestants" ? "Contestants" : "Judges"} (
                {activeTab === "contestants" ? selectedContestants.length : selectedJudges.length})
              </label>
              <div className="flex flex-wrap gap-2 p-3 min-h-12.5 bg-[#1E1F22] rounded-lg border border-[#1E1F22]">
                {(activeTab === "contestants" ? sortedContestantTags : sortedJudgeTags).map(
                  (user) => (
                    <span
                      key={user.idUser}
                      className="inline-flex items-center bg-[#35373C] text-[#DBDEE1] px-2 py-1 rounded text-sm gap-1 animate-in fade-in zoom-in duration-200"
                    >
                      {user.username}
                      <button
                        onClick={() =>
                          activeTab === "contestants"
                            ? handleRemoveContestant(user.idUser)
                            : setSelectedJudges((prev) =>
                                prev.filter((j) => j.idUser !== user.idUser),
                              )
                        }
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ),
                )}
                {(activeTab === "contestants" ? selectedContestants : selectedJudges).length ===
                  0 && <p className="text-[#4E5058] text-sm italic">No users selected yet...</p>}
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
                {activeTab === "contestants" && (
                  <button
                    onClick={handleSelectAllContestants}
                    className="text-sm text-[#5865F2] hover:underline flex items-center gap-1 font-medium"
                  >
                    <CheckSquare className="w-4 h-4" /> Select All Filtered
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-100 overflow-y-auto pr-2 custom-scrollbar">
                {(activeTab === "contestants" ? availableContestants : availableJudges).map(
                  (user) => (
                    <div
                      key={user.idUser}
                      onClick={() =>
                        activeTab === "contestants"
                          ? handleToggleContestant(user)
                          : setSelectedJudges((prev) => [...prev, user])
                      }
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
