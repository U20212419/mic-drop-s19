"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { CheckCircle2, XCircle, Loader2, Lock, Unlock } from "lucide-react";

interface MyRound {
  idRound: number;
  roundNumber: number;
  active: boolean;
  submissionsOpen: boolean;
  role: string;
  groupNumber: number;
}

export default function MyRoundsPage() {
  const [rounds, setRounds] = useState<MyRound[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api
      .get("/my-rounds")
      .then((res) => {
        // Sort rounds by roundNumber ascending
        res.data.sort((a: MyRound, b: MyRound) => a.roundNumber - b.roundNumber);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rounds.map((round) => (
          <div
            key={`${round.idRound}-${round.role}`}
            onClick={() => round.active && router.push(`/my-rounds/${round.idRound}`)}
            className={`bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-6 transition-all ${
              round.active
                ? "hover:border-[#5865F2] cursor-pointer hover:-translate-y-1"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Round {round.roundNumber} {!round.active && <Lock size={16} />}
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    round.active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}
                >
                  {round.active ? (
                    <CheckCircle2 className="w-3 h-3 mr-1.5" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1.5" />
                  )}
                  {round.active ? "Active" : "Inactive"}
                </span>
              </h2>
            </div>
            <div className="flex justify-between mb-4">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                  round.submissionsOpen
                    ? "bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}
              >
                {round.submissionsOpen ? (
                  <Unlock className="w-3 h-3 mr-1" />
                ) : (
                  <Lock className="w-3 h-3 mr-1" />
                )}
                {round.submissionsOpen ? "Submissions Open" : "Submissions Closed"}
              </span>
            </div>
            <div className="space-y-2">
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
