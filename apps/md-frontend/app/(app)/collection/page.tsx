"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Loader2, Disc3, Music, Mic2, ExternalLink, Info, Gift, X } from "lucide-react";
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeBonus, setActiveBonus] = useState<PendingBonus | null>(null);
  const [claimableSongs, setClaimableSongs] = useState<ClaimableSong[]>([]);
  const [selectedSongLink, setSelectedSongLink] = useState<string>("");
  const [isFetchingSongs, setIsFetchingSongs] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

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

  // Helper function to ensure that external URLs are properly formatted with a protocol
  const formatExternalUrl = (url: string) => {
    if (!url) return "";
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
  };

  const handleOpenClaimModal = async (bonus: PendingBonus) => {
    setActiveBonus(bonus);
    setIsModalOpen(true);
    setIsFetchingSongs(true);
    setSelectedSongLink("");

    try {
      const res = await api.get(`/my-rounds/${bonus.idRound}/claimable-songs`);
      setClaimableSongs(res.data);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsFetchingSongs(false);
    }
  };

  const handleClaimBonus = async () => {
    if (!activeBonus || !selectedSongLink) return;

    try {
      setIsClaiming(true);
      await api.post(`/my-rounds/${activeBonus.idRound}/claim-bonus`, selectedSongLink, {
        headers: { "Content-Type": "text/plain" },
      });

      toast.success("Bonus song added to your collection!", { closeButton: true });
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsClaiming(false);
    }
  };

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
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-yellow-500/5">
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
                Claim an extra track from your group before the time runs out.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenClaimModal(pendingBonuses[0])}
            className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-5 rounded-lg transition-colors shrink-0 flex items-center justify-center gap-2"
          >
            Claim Bonus
          </button>
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

                {/* Quantity Badge */}
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
                  <ExternalLink className="w-4 h-4" />
                  Listen on YouTube
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Claim Bonus Modal */}
      {isModalOpen && activeBonus && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#313338] border border-[#1E1F22] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#1E1F22] flex items-center justify-between bg-[#2B2D31]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-yellow-500" />
                Claim Bonus: Round {activeBonus.roundNumber}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#80848E] hover:text-[#DBDEE1] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-[#DBDEE1] text-sm">
                Congratulations on placing 1st! Choose one track submitted by a contestant in your
                group during this round to add to your collection.
              </p>

              {isFetchingSongs ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#5865F2]" />
                </div>
              ) : claimableSongs.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-400 text-sm text-center">
                  No eligible songs found in your group for this round.
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#80848E] uppercase">
                    Select a Track
                  </label>
                  <select
                    className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] rounded-lg p-3 outline-none focus:border-[#5865F2] transition-colors appearance-none"
                    value={selectedSongLink}
                    onChange={(e) => setSelectedSongLink(e.target.value)}
                  >
                    <option value="" disabled>
                      -- Choose a track --
                    </option>
                    {claimableSongs.map((song) => (
                      <option key={song.subLink} value={song.subLink}>
                        {song.artist} - {song.title} (by {song.contestantUsername})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-[#1E1F22] bg-[#2B2D31] flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded font-medium text-white hover:underline disabled:opacity-50"
                disabled={isClaiming}
              >
                Cancel
              </button>
              <button
                onClick={handleClaimBonus}
                disabled={!selectedSongLink || isClaiming || claimableSongs.length === 0}
                className="px-6 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
