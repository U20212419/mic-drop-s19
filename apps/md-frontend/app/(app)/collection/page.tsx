"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import {
  Loader2,
  Disc3,
  Music,
  Mic2,
  ExternalLink,
  Info,
  Gift,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface CollectionItem {
  subLink: string;
  title: string | null;
  artist: string | null;
  quantity: number;
}

interface PendingBonus {
  idRound: number;
  roundNumber: number;
}

interface ClaimableSong {
  subLink: string;
  title: string;
  artist: string;
  contestantUsername: string;
}

export default function CollectionPage() {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [pendingBonuses, setPendingBonuses] = useState<PendingBonus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isBannerExpanded, setIsBannerExpanded] = useState(false);
  const [activeBonus, setActiveBonus] = useState<PendingBonus | null>(null);
  const [claimableSongs, setClaimableSongs] = useState<ClaimableSong[]>([]);
  const [selectedSongLink, setSelectedSongLink] = useState<string>("");
  const [isFetchingSongs, setIsFetchingSongs] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const [claimSearchTerm, setClaimSearchTerm] = useState("");
  const [claimCurrentPage, setClaimCurrentPage] = useState(1);
  const CLAIM_ITEMS_PER_PAGE = 5;

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [colRes, bonusRes] = await Promise.all([
        api.get("/my-rounds/collection"),
        api.get("/my-rounds/pending-bonuses"),
      ]);

      // Ensure we only show items that have at least 1 copy left
      const activeItems = colRes.data.filter((item: CollectionItem) => item.quantity > 0);
      setCollection(activeItems);
      setPendingBonuses(bonusRes.data);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setClaimCurrentPage(1);
  }, [claimSearchTerm]);

  // Helper function to ensure that external URLs are properly formatted with a protocol
  const formatExternalUrl = (url: string) => {
    if (!url) return "";
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
  };

  const handleExpandBanner = async () => {
    const bonus = pendingBonuses[0];
    if (!bonus) return;

    setActiveBonus(bonus);
    setIsBannerExpanded(true);
    setIsFetchingSongs(true);
    setSelectedSongLink("");
    setClaimSearchTerm("");
    setClaimCurrentPage(1);

    try {
      const res = await api.get(`/my-rounds/${bonus.idRound}/claimable-songs`);
      setClaimableSongs(res.data);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsFetchingSongs(false);
    }
  };

  const handleCancelClaim = () => {
    setIsBannerExpanded(false);
    setSelectedSongLink("");
    setClaimSearchTerm("");
  };

  const handleClaimBonus = async () => {
    if (!activeBonus || !selectedSongLink) return;

    try {
      setIsClaiming(true);
      await api.post(`/my-rounds/${activeBonus.idRound}/claim-bonus`, selectedSongLink, {
        headers: { "Content-Type": "text/plain" },
      });

      toast.success("Bonus song added to your collection!", { closeButton: true });
      setIsBannerExpanded(false);
      fetchData();
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsClaiming(false);
    }
  };

  const filteredClaimableSongs = claimableSongs.filter((song) => {
    const term = claimSearchTerm.toLowerCase();
    return (
      song.title.toLowerCase().includes(term) ||
      song.artist.toLowerCase().includes(term) ||
      song.contestantUsername.toLowerCase().includes(term)
    );
  });

  const totalClaimPages = Math.ceil(filteredClaimableSongs.length / CLAIM_ITEMS_PER_PAGE);
  const paginatedSongs = filteredClaimableSongs.slice(
    (claimCurrentPage - 1) * CLAIM_ITEMS_PER_PAGE,
    claimCurrentPage * CLAIM_ITEMS_PER_PAGE,
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Section */}
      <div className="bg-[#2B2D31] p-6 rounded-xl border border-[#1E1F22] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">Collection</h1>
          <p className="text-[#80848E] text-sm mt-1">
            Tracks you have saved. You can use these during Special Rounds.
          </p>
        </div>
        <div className="px-4 py-2 bg-[#1E1F22] border border-[#35373C] rounded-lg flex items-center gap-2">
          <span className="text-xs font-bold text-[#80848E] uppercase tracking-wider">
            Total Unique Tracks:
          </span>
          <span className="text-lg font-black text-[#DBDEE1]">{collection.length}</span>
        </div>
      </div>

      {/* Pending Bonuses Section */}
      {pendingBonuses.length > 0 && (
        <div className="bg-[#2B2D31] border border-yellow-500/50 rounded-xl shadow-lg shadow-yellow-500/5 overflow-hidden transition-all">
          {/* Header del Banner */}
          <div className="bg-yellow-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/20 p-2 rounded-lg shrink-0">
                <Gift className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <h3 className="text-yellow-500 font-bold text-lg leading-tight">
                  You have {pendingBonuses.length} pending 1st Place Bonus
                  {pendingBonuses.length > 1 ? "es" : ""}!
                </h3>
                <p className="text-sm text-yellow-500/80 mt-0.5">
                  {isBannerExpanded
                    ? `Selecting track for Round ${activeBonus?.roundNumber}...`
                    : "Claim an extra track from your group before time runs out. You can only claim bonuses from the current or the previous round."}
                </p>
              </div>
            </div>
            {!isBannerExpanded && (
              <button
                onClick={handleExpandBanner}
                className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-5 rounded-lg transition-colors shrink-0 flex items-center justify-center gap-2"
              >
                Select Track
              </button>
            )}
          </div>

          {isBannerExpanded && (
            <div className="p-5 border-t border-yellow-500/20 space-y-4">
              {isFetchingSongs ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
                </div>
              ) : claimableSongs.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-400 text-sm text-center">
                  No eligible songs found in your group for this round.
                </div>
              ) : (
                <>
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
                    <input
                      type="text"
                      placeholder="Search artist, title, or username..."
                      value={claimSearchTerm}
                      onChange={(e) => setClaimSearchTerm(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] text-sm rounded-md pl-10 pr-4 py-2 focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] outline-none transition-all placeholder:text-[#80848E]"
                    />
                  </div>

                  <div className="space-y-2">
                    {paginatedSongs.length > 0 ? (
                      paginatedSongs.map((song) => (
                        <div
                          key={song.subLink}
                          onClick={() => setSelectedSongLink(song.subLink)}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedSongLink === song.subLink
                              ? "border-yellow-500 bg-yellow-500/10"
                              : "border-[#35373C] bg-[#1E1F22] hover:border-[#4E5058]"
                          }`}
                        >
                          <div className="flex items-start gap-3 overflow-hidden">
                            <div className="mt-1 shrink-0">
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  selectedSongLink === song.subLink
                                    ? "border-yellow-500"
                                    : "border-[#80848E]"
                                }`}
                              >
                                {selectedSongLink === song.subLink && (
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#DBDEE1] truncate">
                                {song.artist} - {song.title}
                              </p>
                              <p className="text-xs text-[#80848E] truncate">
                                Submitted by{" "}
                                <span className="font-medium text-[#DBDEE1]">
                                  {song.contestantUsername}
                                </span>
                              </p>
                            </div>
                          </div>

                          <a
                            href={formatExternalUrl(song.subLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1E1F22] hover:bg-[#35373C] border border-[#35373C] rounded text-[#DBDEE1] text-xs font-medium transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#5865F2]" />
                            Listen
                          </a>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-[#80848E] text-sm">
                        No tracks match your search.
                      </div>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setClaimCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={claimCurrentPage === 1}
                        className="p-1.5 rounded bg-[#1E1F22] text-[#DBDEE1] border border-[#35373C] hover:bg-[#35373C] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-medium text-[#80848E] min-w-16 text-center">
                        {claimCurrentPage} / {Math.max(totalClaimPages, 1)}
                      </span>
                      <button
                        onClick={() =>
                          setClaimCurrentPage((prev) => Math.min(prev + 1, totalClaimPages))
                        }
                        disabled={claimCurrentPage >= totalClaimPages || totalClaimPages === 0}
                        className="p-1.5 rounded bg-[#1E1F22] text-[#DBDEE1] border border-[#35373C] hover:bg-[#35373C] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleCancelClaim}
                        className="px-4 py-2 text-sm font-medium text-[#DBDEE1] hover:underline flex-1 sm:flex-none"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClaimBonus}
                        disabled={!selectedSongLink || isClaiming}
                        className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-1 sm:flex-none"
                      >
                        {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Confirm Claim
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-[#5865F2]/10 border border-[#5865F2]/20 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-[#5865F2] shrink-0 mt-0.5" />
        <p className="text-sm text-[#DBDEE1]">
          Whenever you submit tracks in normal rounds with 3 judges, rounds with more than 3 judges
          and select the "Add to Collection" checkbox, or when you claim a 1st Place Bonus, those
          tracks will appear here. When you use a track in a Special Round, its quantity will
          decrease.
        </p>
      </div>

      {/* Collection Grid / List */}
      {collection.length === 0 ? (
        <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#1E1F22] flex items-center justify-center">
            <Disc3 className="w-8 h-8 text-[#4E5058]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Your collection is empty</h3>
            <p className="text-[#80848E] text-sm mt-1 max-w-sm mx-auto">
              You don't have any tracks available right now. Participate in upcoming rounds and add
              tracks to start building your collection!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collection.map((item, index) => (
            <div
              key={item.subLink || index}
              className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] p-5 flex flex-col justify-between hover:border-[#35373C] transition-colors group"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                  <h3 className="text-lg font-bold text-white flex items-start gap-2">
                    <Music className="w-4 h-4 text-[#5865F2] shrink-0 mt-1.5" />
                    <span className="line-clamp-2 wrap-break-word leading-tight">
                      {item.title || "Pending Review..."}
                    </span>
                  </h3>
                  <p className="text-[#80848E] text-sm flex items-start gap-2">
                    <Mic2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 wrap-break-word leading-tight">
                      {item.artist || "Unknown Artist"}
                    </span>
                  </p>
                </div>

                <div className="bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 flex flex-col items-center justify-center shrink-0 min-w-15">
                  <span className="text-[10px] font-bold text-[#80848E] uppercase mb-0.5">
                    Copies
                  </span>
                  <span className="text-xl font-black text-white leading-none">
                    x{item.quantity}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1E1F22] flex items-center justify-between">
                <a
                  href={formatExternalUrl(item.subLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5865F2] hover:text-[#4752C4] hover:underline text-sm font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Listen on YouTube
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
