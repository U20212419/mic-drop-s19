"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import api from "@/lib/axios";
import {
  Trophy,
  Search,
  Filter,
  Loader2,
  Activity,
  Target,
  Medal,
  ChevronUp,
  ChevronDown,
  Star,
  Skull,
  Users,
  Layers,
  Clock,
  Frown,
  ArrowLeft,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface RoundPerformance {
  roundNumber: number;
  groupNumber: number;
  average: number;
  stdDev: number;
  scores: (number | null)[];
  isPending: boolean; // Spoilers hidden
  isDns: boolean; // Did not submit
  submittedAt?: string; // ISO timestamp of submission
  groupRank?: number;
}

interface ContestantStat {
  idUser: number;
  username: string;
  avatar: string;
  discordId: string;
  currentStatus: string;
  roundsPlayed: number;
  globalAverage: number | null;
  globalStdDev: number | null;
  globalMedian: number | null;
  rounds: Record<number, RoundPerformance>;
}

interface StatsResponse {
  contestants: ContestantStat[];
  availableRounds: number[];
}

interface RankedContestant extends ContestantStat {
  absoluteRank: number;
}

type SortKey = "RANK" | "NAME" | "AVG" | "STDDEV" | "MEDIAN" | `ROUND_${number}`;

export default function PublicStatsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // State for fetched stats data and loading state
  const [data, setData] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters and sorting state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [groupFilterRound, setGroupFilterRound] = useState<string>("LATEST");
  const [groupFilterNum, setGroupFilterNum] = useState<string>("ALL");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "ASC" | "DESC" }>({
    key: "RANK",
    direction: "ASC",
  });
  const [isCompact, setIsCompact] = useState(false);

  // Smart "Go Back" logic
  const handleGoBack = () => {
    const getFallbackRoute = () => {
      // Not logged in -> Main Login Screen
      if (status === "unauthenticated" || !session) return "/";
      // Logged in but INACTIVE -> Judge App
      if (session.user?.status === "INACTIVE") return "/judge-app";
      // Logged in and not INACTIVE -> Main Home Dashboard
      return "/home";
    };

    // Detect if the user navigated directly to the stats page (no history)
    const isExternalAccess =
      window.history.length <= 2 && !document.referrer.includes(window.location.host);

    if (isExternalAccess) {
      // If accessed externally, redirect to a sensible fallback route based on session status
      router.push(getFallbackRoute());
    } else {
      // If accessed internally, go back to the previous page in history
      router.back();
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/public/stats");
        setData(res.data);
      } catch (error) {
        // Error handled by interceptor
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getDefaultAvatarUrl = (discordId: string) => {
    try {
      const index = Number((BigInt(discordId) >> BigInt(22)) % BigInt(5));
      return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    } catch {
      return `https://cdn.discordapp.com/embed/avatars/0.png`;
    }
  };

  // Replicated Java color rules for individual scores
  const getScoreColorClass = (score: number) => {
    if (score === 10.0) return "text-[#FFDF66] bg-[#FFDF66]/10 border-[#FFDF66]/30"; // COLOR_GOLD
    if (score >= 9.0) return "text-[#77DD77] bg-[#77DD77]/10 border-[#77DD77]/30"; // COLOR_GREEN
    if (score > 3.0) return "text-white bg-white/10 border-white/30"; // COLOR_WHITE
    return "text-[#FF6961] bg-[#FF6961]/10 border-[#FF6961]/30"; // COLOR_RED
  };

  // Formats ISO date to dd-MMM-yy HH:mm:ss (e.g., 17-Sep-26 15:30:45)
  // Forces English locale for the month abbreviation to keep it standard globally
  const formatSubmittedAt = (dateString?: string) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleString("en-US", { month: "short" }); // Sep, Oct, Nov...
    const year = date.getFullYear().toString().slice(-2);

    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  // Determine exactly which round we are using as the reference context
  const targetRoundNumber = useMemo(() => {
    if (!data || data.availableRounds.length === 0) return 0;
    return groupFilterRound === "LATEST"
      ? Math.max(...data.availableRounds)
      : Number(groupFilterRound);
  }, [data, groupFilterRound]);

  // Extract dynamically only the unique groups present in the selected target round
  const availableGroups = useMemo(() => {
    if (!data || targetRoundNumber === 0) return [];

    const groups = new Set<number>();
    data.contestants.forEach((c) => {
      const roundData = c.rounds[targetRoundNumber];
      if (roundData && roundData.groupNumber) {
        groups.add(roundData.groupNumber);
      }
    });

    return Array.from(groups).sort((a, b) => a - b);
  }, [data, targetRoundNumber]);

  // Automatically reset the group dropdown to "ALL" if the context round changes to avoid being stuck filtering by groups that are not present in a round
  useEffect(() => {
    setGroupFilterNum("ALL");
  }, [groupFilterRound]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key ? (prev.direction === "ASC" ? "DESC" : "ASC") : "DESC",
    }));
  };

  const rankedContestants = useMemo<RankedContestant[]>(() => {
    if (!data) return [];

    let currentRank = 1;

    return data.contestants.map((c, index, arr) => {
      if (index > 0) {
        const prev = arr[index - 1];

        // Determine if the current contestant's survival status is the same as the previous contestant's survival status
        const sameSurvival = (c.currentStatus === "ACTIVE") === (prev.currentStatus === "ACTIVE");

        // Determine if there's a perfect tie
        const isPerfectTie =
          c.roundsPlayed === prev.roundsPlayed &&
          sameSurvival &&
          c.globalAverage === prev.globalAverage &&
          c.globalStdDev === prev.globalStdDev &&
          c.globalMedian === prev.globalMedian;

        // If it's not a perfect tie, increment the rank; otherwise, keep the same rank
        if (!isPerfectTie) {
          currentRank = index + 1;
        }
      } else {
        currentRank = 1;
      }

      return {
        ...c,
        absoluteRank: currentRank,
      };
    });
  }, [data]);

  const processedContestants = useMemo(() => {
    let result = [...rankedContestants];

    // Filtering
    result = result.filter((c) => {
      const matchesSearch = c.username.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || c.currentStatus === statusFilter;

      let matchesGroup = true;
      if (groupFilterNum !== "ALL") {
        // Evaluate the group strictly based on the contextual target round
        const roundData = c.rounds[targetRoundNumber];
        matchesGroup = roundData ? roundData.groupNumber === Number(groupFilterNum) : false;
      }

      return matchesSearch && matchesStatus && matchesGroup;
    });

    // Sorting
    result.sort((a, b) => {
      // DNS globally always sink to the bottom regardless of sort direction
      const aIsDns = a.globalAverage === null;
      const bIsDns = b.globalAverage === null;

      if (aIsDns && !bIsDns) return 1;
      if (!aIsDns && bIsDns) return -1;
      if (aIsDns && bIsDns) return 0;

      let comparison = 0;
      switch (sortConfig.key) {
        case "RANK":
          comparison = a.absoluteRank - b.absoluteRank;
          break;
        case "NAME":
          comparison = a.username.localeCompare(b.username);
          break;
        case "AVG":
          // Primary: Average
          comparison = a.globalAverage! - b.globalAverage!;
          if (comparison === 0) {
            // Secondary: Rounds Played
            comparison = a.roundsPlayed - b.roundsPlayed;
            if (comparison === 0) {
              // Tertiary: Consistency (Lower StdDev is better)
              comparison = b.globalStdDev! - a.globalStdDev!;
            }
          }
          break;
        case "STDDEV":
          comparison = b.globalStdDev! - a.globalStdDev!;
          if (comparison === 0) comparison = a.roundsPlayed - b.roundsPlayed;
          break;
        case "MEDIAN":
          comparison = a.globalMedian! - b.globalMedian!;
          if (comparison === 0) comparison = a.roundsPlayed - b.roundsPlayed;
          break;
        default:
          if (sortConfig.key.startsWith("ROUND_")) {
            const rNum = parseInt(sortConfig.key.split("_")[1]);
            const aPerf = a.rounds[rNum];
            const bPerf = b.rounds[rNum];

            // Push round-level DNS/Pending to the bottom
            const aValid = aPerf && !aPerf.isPending && !aPerf.isDns;
            const bValid = bPerf && !bPerf.isPending && !bPerf.isDns;
            if (!aValid && bValid) return 1;
            if (aValid && !bValid) return -1;
            if (!aValid && !bValid) return 0;

            // Round tie-breakers: Average -> StdDev -> SubmittedAt
            comparison = aPerf.average - bPerf.average;

            if (comparison === 0) {
              comparison = bPerf.stdDev - aPerf.stdDev;

              if (comparison === 0 && aPerf.submittedAt && bPerf.submittedAt) {
                const timeA = new Date(aPerf.submittedAt).getTime();
                const timeB = new Date(bPerf.submittedAt).getTime();
                comparison = timeB - timeA;
              }
            }
          }
      }
      return sortConfig.direction === "ASC" ? comparison : -comparison;
    });

    return result;
  }, [rankedContestants, search, statusFilter, groupFilterRound, groupFilterNum, sortConfig, data]);

  // Evaluates scored rounds to assign best/worst badges and identifies the elimination round
  const getHighlights = (c: RankedContestant) => {
    const revealedRounds = Object.values(c.rounds).filter((r) => !r.isPending);
    const validRounds = revealedRounds.filter((r) => !r.isDns);

    // Identify elimination round: the last valid round played by an eliminated contestant
    let eliminationRound: number | null = null;
    if (c.currentStatus === "ELIMINATED" && validRounds.length > 0) {
      eliminationRound = Math.max(...validRounds.map((r) => r.roundNumber));
    }

    if (validRounds.length === 0) {
      return { bestRoundNumbers: [], worstRoundNumbers: [], eliminationRound };
    }

    if (validRounds.length === 1) {
      let bestRoundNumbers: number[] = [];
      if (revealedRounds.length > 1) {
        bestRoundNumbers = [validRounds[0].roundNumber];
      }
      return { bestRoundNumbers, worstRoundNumbers: [], eliminationRound };
    }

    // Pre-calculate metrics for best/worst rounds across all contestants to avoid recalculating them for each row
    const roundsWithMetrics = validRounds.map((r) => {
      const getMedian = (arr: (number | null)[]) => {
        if (!arr || arr.length === 0) return 0;
        const numericArray = arr.map((score) => (score === null ? 0 : score));
        const s = [...numericArray].sort((x, y) => x - y);
        const m = Math.floor(s.length / 2);
        return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
      };

      return {
        ...r,
        medianScore: getMedian(r.scores),
        safeGroupRank: r.groupRank ?? 999,
      };
    });

    const sortedRounds = roundsWithMetrics.sort((a, b) => {
      // Priority 1: Average (higher is better)
      if (a.average !== b.average) return b.average - a.average;

      // Priority 2: Standard deviation (lower is better)
      if (a.stdDev !== b.stdDev) return a.stdDev - b.stdDev;

      // Priority 3: Median of individual scores (higher is better)
      if (a.medianScore !== b.medianScore) return b.medianScore - a.medianScore;

      // Priority 4: Rank within the group (lower is better)
      return a.safeGroupRank - b.safeGroupRank;
    });

    // Find all tied rounds for best and worst
    let bestRoundNumbers: number[] = [];
    let worstRoundNumbers: number[] = [];

    if (sortedRounds.length > 0) {
      const top = sortedRounds[0];
      // Filter all rounds that are tied for the best
      bestRoundNumbers = sortedRounds
        .filter(
          (r) =>
            r.average === top.average &&
            r.stdDev === top.stdDev &&
            r.medianScore === top.medianScore &&
            r.safeGroupRank === top.safeGroupRank,
        )
        .map((r) => r.roundNumber);

      const bottom = sortedRounds[sortedRounds.length - 1];
      // Filter all rounds that are tied for the worst
      worstRoundNumbers = sortedRounds
        .filter(
          (r) =>
            r.average === bottom.average &&
            r.stdDev === bottom.stdDev &&
            r.medianScore === bottom.medianScore &&
            r.safeGroupRank === bottom.safeGroupRank,
        )
        .map((r) => r.roundNumber);
    }

    return { bestRoundNumbers, worstRoundNumbers, eliminationRound };
  };

  const renderSortableHeader = (
    sortKey: SortKey,
    label: string,
    customClass: string = "",
    Icon?: any,
    title?: string,
  ) => {
    const isActive = sortConfig.key === sortKey;
    const isCentered = customClass.includes("text-center");

    return (
      <th
        key={sortKey}
        onClick={() => handleSort(sortKey)}
        className={`px-6 ${isCompact ? "py-2.5" : "py-5"} cursor-pointer transition-colors select-none group sticky top-0 z-30 bg-[#1E1F22] border-b border-[#35373C] ${
          isActive ? "bg-[#35373C]! shadow-inner" : "hover:bg-[#2B2D31]"
        } ${customClass}`}
        title={title}
      >
        <div className={`flex items-center gap-1.5 ${isCentered ? "justify-center" : ""}`}>
          {Icon && (
            <Icon
              className={`w-4 h-4 transition-colors ${
                isActive
                  ? "opacity-100 text-[#DBDEE1]"
                  : "opacity-70 text-[#80848E] group-hover:opacity-100"
              }`}
            />
          )}
          <span
            className={`transition-colors ${isActive ? "text-[#DBDEE1]" : "text-[#80848E] group-hover:text-[#DBDEE1]"}`}
          >
            {label}
          </span>
          <div className="flex flex-col ml-1">
            <ChevronUp
              className={`w-3 h-3 -mb-1 transition-colors ${
                isActive && sortConfig.direction === "ASC" ? "text-[#5865F2]" : "text-[#4E5058]"
              }`}
            />
            <ChevronDown
              className={`w-3 h-3 transition-colors ${
                isActive && sortConfig.direction === "DESC" ? "text-[#5865F2]" : "text-[#4E5058]"
              }`}
            />
          </div>
        </div>
      </th>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#313338] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5865F2] mb-4" />
        <p className="text-[#80848E] font-medium animate-pulse">Computing global leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#313338] text-white p-4 sm:p-8">
      <div className="max-w-350 mx-auto space-y-6 sm:space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#1E1F22] pb-6">
          <div>
            {/* Back Button */}
            <button
              onClick={handleGoBack}
              className="flex items-center gap-1.5 text-xs font-bold text-[#80848E] hover:text-[#DBDEE1] bg-[#1E1F22] hover:bg-[#35373C] border border-[#35373C] px-3 py-1.5 rounded-md transition-colors w-fit mb-4"
              title="Return to application"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back
            </button>

            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Trophy className="w-8 h-8 text-[#F1C40F]" />
              Season 19 Stats
            </h1>
            <p className="text-[#80848E] mt-2 text-sm max-w-xl leading-relaxed">
              Global statistics across all completed rounds. Contestants are ranked by round
              reached, survival status and average by default. Ties are broken by standard
              deviation, then median.
            </p>
            {/* Legends */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-[#F1C40F] drop-shadow-md" />
                <span className="text-[#80848E] text-sm">Personal Best Round</span>
              </div>
              <div className="flex items-center gap-1">
                <Frown className="w-3.5 h-3.5 text-[#E67E22] drop-shadow-md" />
                <span className="text-[#80848E] text-sm">Personal Worst Round</span>
              </div>
              <div className="flex items-center gap-1">
                <Skull className="w-3.5 h-3.5 text-[#FF6961] drop-shadow-md" />
                <span className="text-[#80848E] text-sm">Eliminated in this Round</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 shrink-0">
            <div className="bg-[#2B2D31] px-5 py-3 rounded-xl border border-[#1E1F22] text-center shadow-sm">
              <p className="text-[#80848E] text-[10px] font-black uppercase tracking-widest mb-1">
                Active
              </p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                {data?.contestants.filter((c) => c.currentStatus === "ACTIVE").length || 0}
              </p>
            </div>
            <div className="bg-[#2B2D31] px-5 py-3 rounded-xl border border-[#1E1F22] text-center shadow-sm">
              <p className="text-[#80848E] text-[10px] font-black uppercase tracking-widest mb-1">
                Eliminated
              </p>
              <p className="text-2xl font-bold text-red-400 tabular-nums">
                {data?.contestants.filter(
                  (c) => c.currentStatus === "ELIMINATED" || c.currentStatus === "DID_NOT_SUBMIT",
                ).length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-[#2B2D31] p-4 rounded-xl border border-[#1E1F22] shadow-sm">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
            <input
              type="text"
              placeholder="Search contestant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] text-sm rounded-lg pl-9 pr-4 py-2.5 focus:border-[#5865F2] outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-[#1E1F22] border border-[#35373C] px-3 py-2.5 rounded-lg focus-within:border-[#5865F2]">
            <Filter className="w-4 h-4 text-[#80848E] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent text-sm text-[#DBDEE1] outline-none cursor-pointer [&>option]:bg-[#2B2D31]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="ELIMINATED">Eliminated Only</option>
              <option value="DID_NOT_SUBMIT">DNS Only</option>
            </select>
          </div>

          {/* Target Round Reference */}
          <div className="flex items-center gap-2 bg-[#1E1F22] border border-[#35373C] px-3 py-2.5 rounded-lg focus-within:border-[#5865F2]">
            <Layers className="w-4 h-4 text-[#80848E] shrink-0" />
            <select
              value={groupFilterRound}
              onChange={(e) => setGroupFilterRound(e.target.value)}
              className="w-full bg-transparent text-sm text-[#DBDEE1] outline-none cursor-pointer [&>option]:bg-[#2B2D31]"
            >
              <option value="LATEST">Context: Latest Round</option>
              {data?.availableRounds.map((rNum) => (
                <option key={rNum} value={rNum}>
                  Context: Round {rNum}
                </option>
              ))}
            </select>
          </div>

          {/* Group Filter */}
          <div className="flex items-center gap-2 bg-[#1E1F22] border border-[#35373C] px-3 py-2.5 rounded-lg focus-within:border-[#5865F2]">
            <Users className="w-4 h-4 text-[#80848E] shrink-0" />
            <select
              value={groupFilterNum}
              onChange={(e) => setGroupFilterNum(e.target.value)}
              className="w-full bg-transparent text-sm text-[#DBDEE1] outline-none cursor-pointer [&>option]:bg-[#2B2D31]"
            >
              <option value="ALL">All Groups</option>
              {availableGroups.map((gNum) => (
                <option key={gNum} value={gNum}>
                  Group {gNum}
                </option>
              ))}
            </select>
          </div>

          {/* Compact View Toggle */}
          <button
            onClick={() => setIsCompact((prev) => !prev)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors h-full ${
              isCompact
                ? "bg-[#5865F2]/10 border-[#5865F2]/50 text-[#5865F2]"
                : "bg-[#1E1F22] border-[#35373C] text-[#80848E] hover:border-[#5865F2] hover:text-[#DBDEE1]"
            }`}
            title="Toggle compact view"
          >
            {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            <span className="text-sm font-medium">{isCompact ? "Expand" : "Compact"}</span>
          </button>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] shadow-xl overflow-hidden flex flex-col">
          <div className="overflow-auto max-h-[75vh] custom-scrollbar">
            <table className="w-full text-left border-separate border-spacing-0 table-fixed min-w-300">
              <thead>
                <tr className="text-[#80848E] text-[11px] font-black uppercase tracking-wider">
                  {renderSortableHeader("RANK", "Rank", "w-[90px] md:left-0 md:z-40")}

                  {/* Name Header */}
                  {renderSortableHeader(
                    "NAME",
                    "Contestant",
                    "w-[260px] md:left-22.5 md:z-40 md:shadow-[4px_0_10px_-3px_rgba(0,0,0,0.3)]",
                  )}

                  <th
                    className={`px-6 ${isCompact ? "py-2.5" : "py-5"} select-none w-35 sticky top-0 z-30 bg-[#1E1F22] border-b border-[#35373C]`}
                  >
                    Status
                  </th>

                  {renderSortableHeader(
                    "AVG",
                    "Overall Avg.",
                    "w-[150px] border-l border-[#35373C] !bg-[#232428]",
                    Medal,
                    "Global Average across all scored rounds",
                  )}
                  {renderSortableHeader(
                    "STDDEV",
                    "Std. Dev.",
                    "w-[160px] !bg-[#232428]",
                    Activity,
                    "Standard Deviation across all scored rounds",
                  )}
                  {renderSortableHeader(
                    "MEDIAN",
                    "Median",
                    "w-[140px] border-r border-[#35373C] !bg-[#232428]",
                    Target,
                    "Global Median across all scored rounds",
                  )}

                  {data?.availableRounds.map((rNum) =>
                    renderSortableHeader(
                      `ROUND_${rNum}` as SortKey,
                      `R${rNum} Perf.`,
                      "w-[170px] text-center border-r border-[#35373C] last:border-0",
                    ),
                  )}
                </tr>
              </thead>

              <tbody className="[&>tr>td]:border-b [&>tr>td]:border-[#1E1F22]">
                {processedContestants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6 + (data?.availableRounds.length || 0)}
                      className="px-6 py-16 text-center text-[#80848E]"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="w-8 h-8 opacity-50" />
                        <p>No contestants match your current filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedContestants.map((c) => {
                    const rank = c.absoluteRank;
                    const highlights = getHighlights(c);
                    const isGlobalDns = c.globalAverage === null;

                    return (
                      <tr key={c.idUser} className="hover:bg-[#35373C]/40 transition-colors group">
                        {/* Rank */}
                        <td
                          className={`px-6 ${isCompact ? "py-2" : "py-4"} md:sticky md:left-0 z-10 bg-[#2B2D31] group-hover:bg-[#323438] transition-colors`}
                        >
                          <span
                            className={`font-mono font-bold text-lg drop-shadow-sm ${isGlobalDns ? "text-[#4E5058]" : rank === 1 ? "text-[#F1C40F]" : rank === 2 ? "text-[#C0C0C0]" : rank === 3 ? "text-[#CD7F32]" : "text-[#80848E]"}`}
                          >
                            {isGlobalDns ? "--" : `#${rank}`}
                          </span>
                        </td>

                        {/* Contestant Details */}
                        <td
                          className={`px-6 ${isCompact ? "py-2" : "py-4"} font-medium text-white min-w-65 md:sticky md:left-22.5 z-10 bg-[#2B2D31] group-hover:bg-[#323438] transition-colors md:shadow-[4px_0_10px_-3px_rgba(0,0,0,0.3)]`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                c.avatar
                                  ? `https://cdn.discordapp.com/avatars/${c.discordId}/${c.avatar}.png?size=64`
                                  : getDefaultAvatarUrl(c.discordId)
                              }
                              alt={c.username}
                              onError={(e) =>
                                (e.currentTarget.src = getDefaultAvatarUrl(c.discordId))
                              }
                              className="w-8 h-8 rounded-full bg-[#1E1F22] shrink-0 object-cover border border-[#35373C]"
                            />
                            <span className="truncate" title={c.username}>
                              {c.username}
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className={`px-6 ${isCompact ? "py-2" : "py-4"}`}>
                          <span
                            className={`text-[9px] lg:text-[10px] font-black px-2 lg:px-2.5 py-1 rounded shadow-sm uppercase tracking-widest whitespace-nowrap ${
                              c.currentStatus === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : c.currentStatus === "ELIMINATED"
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : "bg-[#4E5058]/20 text-[#80848E] border border-[#4E5058]/30"
                            }`}
                          >
                            {c.currentStatus === "DID_NOT_SUBMIT" ? (
                              <>
                                <span className="lg:hidden">DNS</span>
                                <span className="hidden lg:inline">DID NOT SUBMIT</span>
                              </>
                            ) : (
                              c.currentStatus.replace(/_/g, " ")
                            )}
                          </span>
                        </td>

                        {/* Global Stats */}
                        <td
                          className={`px-6 ${isCompact ? "py-2" : "py-4"} border-l border-[#35373C]/50 font-bold tabular-nums bg-[#2B2D31]/10`}
                        >
                          {isGlobalDns ? (
                            <span className="text-[#4E5058] text-sm">DNS</span>
                          ) : (
                            <span className="text-[#F1C40F] text-lg">
                              {c.globalAverage!.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-6 ${isCompact ? "py-2" : "py-4"} tabular-nums bg-[#2B2D31]/10`}
                        >
                          {isGlobalDns ? (
                            <span className="text-[#4E5058] text-sm">DNS</span>
                          ) : (
                            <span className="text-emerald-400 font-mono text-sm">
                              ±{c.globalStdDev!.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-6 ${isCompact ? "py-2" : "py-4"} border-r border-[#35373C]/50 tabular-nums bg-[#2B2D31]/10`}
                        >
                          {isGlobalDns ? (
                            <span className="text-[#4E5058] text-sm">DNS</span>
                          ) : (
                            <span className="text-blue-400 font-mono text-sm">
                              {c.globalMedian!.toFixed(2)}
                            </span>
                          )}
                        </td>

                        {/* Round-by-Round Stats */}
                        {data?.availableRounds.map((rNum) => {
                          const rData = c.rounds[rNum];
                          // Precedence booleans
                          const isEliminatedRound = highlights.eliminationRound === rNum;
                          const isBest = highlights.bestRoundNumbers?.includes(rNum);
                          const isWorst =
                            highlights.worstRoundNumbers?.includes(rNum) &&
                            !isBest &&
                            !isEliminatedRound;

                          // Apply colors based on precedence.
                          let scoreColorClass = "text-white";
                          if (isEliminatedRound)
                            scoreColorClass = "text-[#FF6961]"; // Red
                          else if (isBest)
                            scoreColorClass = "text-[#F1C40F]"; // Gold
                          else if (isWorst) scoreColorClass = "text-[#E67E22]"; // Orange

                          if (!rData || rData.isPending) {
                            // Check if the user is eliminated and this round happens after their elimination
                            // If eliminationRound is null but they are eliminated, it means they never played (global DNS), so it's also N/A
                            const isNA =
                              (c.currentStatus === "ELIMINATED" ||
                                c.currentStatus === "DID_NOT_SUBMIT") &&
                              (!highlights.eliminationRound || rNum > highlights.eliminationRound);

                            return (
                              <td
                                key={rNum}
                                className={`px-6 ${isCompact ? "py-2" : "py-3"} text-center border-r border-[#35373C]/50 last:border-0 bg-[#1E1F22]/20`}
                                title={
                                  isNA
                                    ? "Not applicable (contestant eliminated)"
                                    : "Results pending application"
                                }
                              >
                                <span
                                  className={`text-[11px] font-bold uppercase tracking-wider italic ${isNA ? "text-[#4E5058]/50" : "text-[#4E5058]"}`}
                                >
                                  {isNA ? "N/A" : "TBD"}
                                </span>
                              </td>
                            );
                          }

                          if (rData.isDns) {
                            return (
                              <td
                                key={rNum}
                                className="px-6 py-4 text-center border-r border-[#35373C]/50 last:border-0 bg-[#1E1F22]/20"
                                title="Did Not Submit for this round"
                              >
                                <span className="text-red-400 text-[11px] font-bold uppercase tracking-wider">
                                  DNS
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={rNum}
                              className="px-6 py-3 text-center border-r border-[#35373C]/50 last:border-0 min-w-37.5 relative"
                            >
                              {/* Badges with Precedence */}
                              {isEliminatedRound ? (
                                <span
                                  title="Eliminated in this round"
                                  className="absolute top-2 right-2 flex items-center"
                                >
                                  <Skull className="w-3.5 h-3.5 text-[#FF6961] drop-shadow-md" />
                                </span>
                              ) : isBest ? (
                                <span
                                  title="Personal Best Round"
                                  className="absolute top-2 right-2 flex items-center"
                                >
                                  <Star className="w-3.5 h-3.5 text-[#F1C40F] drop-shadow-md" />
                                </span>
                              ) : isWorst ? (
                                <span
                                  title="Personal Worst Round"
                                  className="absolute top-2 right-2 flex items-center"
                                >
                                  <Frown className="w-3.5 h-3.5 text-[#E67E22] drop-shadow-md" />
                                </span>
                              ) : null}

                              <div className="flex flex-col items-center">
                                <span
                                  className={`font-bold text-lg tracking-tight ${scoreColorClass}`}
                                >
                                  {rData.average.toFixed(2)}
                                </span>

                                {!isCompact && (
                                  <>
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#80848E] font-medium bg-[#1E1F22] px-2 py-0.5 rounded-sm border border-[#35373C]">
                                      <span title="Assigned Group">G{rData.groupNumber}</span>
                                      <span className="opacity-50">•</span>

                                      {/* Group Rank Badge */}
                                      <span
                                        title={`Ranked #${rData.groupRank} in Group ${rData.groupNumber}`}
                                        className={`${
                                          rData.groupRank === 1
                                            ? "text-[#F1C40F] font-bold"
                                            : rData.groupRank === 2
                                              ? "text-[#C0C0C0] font-bold"
                                              : rData.groupRank === 3
                                                ? "text-[#CD7F32] font-bold"
                                                : ""
                                        }`}
                                      >
                                        #{rData.groupRank}
                                      </span>
                                      <span className="opacity-50">•</span>
                                      <span title="Round Standard Deviation">
                                        ±{rData.stdDev.toFixed(2)}
                                      </span>
                                    </div>

                                    {/* Colored Individual Scores */}
                                    <div className="mt-2 flex flex-wrap justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                                      {rData.scores.map((score, i) => {
                                        const isPartialDns = score === null;
                                        const colorClass = isPartialDns
                                          ? getScoreColorClass(0)
                                          : getScoreColorClass(score);

                                        return (
                                          <span
                                            key={i}
                                            title={
                                              isPartialDns ? "Did Not Submit" : `Score: ${score}`
                                            }
                                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shadow-sm ${colorClass}`}
                                          >
                                            {isPartialDns ? "DNS" : score}
                                          </span>
                                        );
                                      })}
                                    </div>

                                    {/* Exact Submission Time */}
                                    {rData.submittedAt && (
                                      <div
                                        title="Last valid submission time for this round"
                                        className="mt-2.5 flex items-center gap-1 text-[9px] font-mono text-[#80848E]/70 group-hover:text-[#80848E] transition-colors"
                                      >
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{formatSubmittedAt(rData.submittedAt)}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
