"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { CheckCircle2, XCircle, Loader2, Lock, Unlock, Star } from "lucide-react";

interface MyRound {
  idRound: number;
  roundNumber: number;
  active: boolean;
  submissionsOpen: boolean;
  role: string;
  groupNumber: number;
  specialRound: boolean;
}

export default function MyRoundsPage() {
  const [rounds, setRounds] = useState<MyRound[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api
      .get("/my-rounds")
      .then((res) => {
        // Sort rounds by roundNumber ascending and then by groupNumber ascending
        res.data.sort(
          (a: MyRound, b: MyRound) =>
            a.roundNumber - b.roundNumber || a.groupNumber - b.groupNumber,
        );
        setRounds(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-[#2B2D31] p-6 rounded-xl border border-[#1E1F22]">
        <h1 className="text-2xl font-bold text-white">My Rounds</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rounds.map((round) => (
          <div
            key={`${round.idRound}-${round.role}-${round.groupNumber || 1}`}
            onClick={() =>
              round.active &&
              router.push(`/my-rounds/${round.idRound}?group=${round.groupNumber || 1}`)
            }
            className={`bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-5 sm:p-6 transition-all ${
              round.active
                ? "hover:border-[#5865F2] cursor-pointer hover:-translate-y-1 shadow-md"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex flex-col gap-3 mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Round {round.roundNumber}
                {!round.active && <Lock size={18} className="text-[#80848E] shrink-0" />}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium border shrink-0 ${
                    round.active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}
                >
                  {round.active ? (
                    <CheckCircle2 className="w-3 h-3 mr-1.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1.5 shrink-0" />
                  )}
                  {round.active ? "Active" : "Inactive"}
                </span>

                {round.specialRound && (
                  <span className="bg-[#E67E22]/10 text-[#E67E22] border border-[#E67E22]/30 text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <Star className="w-3 h-3 shrink-0" /> Special
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap mb-5">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium border shrink-0 ${
                  round.submissionsOpen
                    ? "bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}
              >
                {round.submissionsOpen ? (
                  <Unlock className="w-3 h-3 mr-1 shrink-0" />
                ) : (
                  <Lock className="w-3 h-3 mr-1 shrink-0" />
                )}
                {round.submissionsOpen ? "Submissions Open" : "Submissions Closed"}
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-[#80848E]">
                Role: <span className="text-white font-bold">{round.role}</span>
              </p>
              <p className="text-sm text-[#80848E]">
                Group: <span className="text-white font-bold">{round.groupNumber}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
