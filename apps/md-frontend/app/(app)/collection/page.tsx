"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Loader2, Disc3, Music, Mic2, ExternalLink, Info } from "lucide-react";

interface CollectionItem {
  subLink: string;
  title: string | null;
  artist: string | null;
  quantity: number;
}

export default function CollectionPage() {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/my-rounds/collection");

        // Ensure we only show items that have at least 1 copy left
        const activeItems = res.data.filter((item: CollectionItem) => item.quantity > 0);
        setCollection(activeItems);
      } catch (error: any) {
        // Error handled by interceptor
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollection();
  }, []);

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

      {/* Info Banner */}
      <div className="bg-[#5865F2]/10 border border-[#5865F2]/20 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-[#5865F2] shrink-0 mt-0.5" />
        <p className="text-sm text-[#DBDEE1]">
          Whenever you submit tracks in normal rounds (with more than 3 judges) and select the "Add
          to Collection" checkbox, or when you claim a 1st Place Bonus, those tracks will appear
          here. When you use a track in a Special Round, its quantity will decrease.
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
                  href={item.subLink}
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
    </div>
  );
}
