"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/axios";
import {
  Search,
  Plus,
  Trophy,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  AlertTriangle,
  Edit,
  Trash2,
} from "lucide-react";

export interface Round {
  idRound: number;
  roundNumber: number;
  active: boolean;
}

export default function RoundsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const userRole = (session?.user as any)?.role || "USER";
  const isAdmin = userRole === "ADMIN";

  // State management
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New round form
  const [newRoundNumber, setNewRoundNumber] = useState<number | "">("");

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchRounds();
    }
  }, [authStatus]);

  const fetchRounds = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/rounds");

      // Sort by round number
      const sortedRounds = res.data.sort((a: Round, b: Round) => a.roundNumber - b.roundNumber);
      setRounds(sortedRounds);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRound = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newRoundNumber === "") return;

    try {
      setIsSubmitting(true);

      // By default new rounds are created as inactive
      const payload = { roundNumber: Number(newRoundNumber), active: false };

      const res = await api.post("/rounds", payload);

      // Update local state with the new round
      setRounds((prev) => [...prev, res.data].sort((a, b) => a.roundNumber - b.roundNumber));

      toast.success("Round created successfully.", {
        description: `The round ${newRoundNumber} has been added to the system.`,
        closeButton: true,
      });

      setIsCreateModalOpen(false);
      setNewRoundNumber("");
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!roundToDelete) return;

    try {
      setIsSubmitting(true);
      await api.delete(`/rounds/${roundToDelete.idRound}`);

      setRounds((prev) => prev.filter((r) => r.idRound !== roundToDelete.idRound));

      toast.success("Round deleted successfully.", {
        description: `The round ${roundToDelete.roundNumber} has been removed from the system.`,
        closeButton: true,
      });

      setRoundToDelete(null);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRounds = rounds.filter((round) =>
    round.roundNumber.toString().includes(searchTerm),
  );

  return (
    <div className="space-y-6 relative">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Round Management</h1>
          <p className="text-[#80848E] text-sm mt-1">View and manage rounds for the competition.</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-md font-medium flex items-center justify-center transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Round
          </button>
        )}
      </div>

      {/* Toolbar (Search) */}
      <div className="bg-[#2B2D31] p-4 rounded-t-lg border border-[#1E1F22] flex items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
          <input
            type="text"
            placeholder="Search round number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1E1F22] border-none text-[#DBDEE1] text-sm rounded-md pl-10 pr-4 py-2 focus:ring-1 focus:ring-[#5865F2] focus:outline-none placeholder:text-[#80848E]"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[#2B2D31] rounded-b-lg border border-t-0 border-[#1E1F22] overflow-x-auto min-h-75">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#80848E]">
            <Loader2 className="w-8 h-8 animate-spin text-[#5865F2] mb-4" />
            <p>Loading rounds...</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-[#DBDEE1]">
            <thead className="text-xs text-[#80848E] uppercase bg-[#1E1F22]/50 border-b border-[#1E1F22]">
              <tr>
                <th className="px-6 py-4 font-semibold">Round Number</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                {isAdmin && <th className="px-6 py-4 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRounds.length > 0 ? (
                filteredRounds.map((round) => (
                  <tr
                    key={round.idRound}
                    className="border-b border-[#1E1F22] hover:bg-[#35373C]/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
                        <Trophy className="w-4 h-4" />
                      </div>
                      Round {round.roundNumber}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          round.active
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-gray-500/10 text-[#80848E] border-gray-500/20"
                        }`}
                      >
                        {round.active ? (
                          <CheckCircle2 className="w-3 h-3 mr-1.5" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1.5" />
                        )}
                        {round.active ? "Ongoing (Active)" : "Inactive"}
                      </span>
                    </td>

                    {isAdmin && (
                      <td className="px-6 py-4 text-right space-x-3">
                        {/* The edit button navigates to the round's configuration page */}
                        <button
                          onClick={() => router.push(`/management/rounds/${round.idRound}`)}
                          className="text-[#5865F2] hover:text-[#4752C4] font-medium transition-colors inline-flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-1" /> Configure
                        </button>
                        <button
                          onClick={() => setRoundToDelete(round)}
                          className="text-red-400 hover:text-red-500 font-medium transition-colors inline-flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 3 : 2} className="px-6 py-8 text-center text-[#80848E]">
                    No rounds found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Round Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1E1F22]">
              <h2 className="text-lg font-bold text-white">Create New Round</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#80848E] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRound} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#80848E] uppercase mb-1.5">
                  Round Number
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newRoundNumber}
                  onChange={(e) => setNewRoundNumber(Number(e.target.value))}
                  className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] rounded-md px-3 py-2 focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] outline-none transition-all"
                  placeholder="e.g. 1"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#DBDEE1] hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newRoundNumber === ""}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-md text-sm font-semibold transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {roundToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Delete Round</h2>
              <p className="text-[#80848E] text-sm">
                Are you sure you want to delete{" "}
                <span className="font-bold text-[#DBDEE1]">round {roundToDelete.roundNumber}</span>?
                This action cannot be undone.
              </p>
            </div>

            <div className="bg-[#1E1F22] p-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRoundToDelete(null)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-[#DBDEE1] hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md text-sm font-semibold transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
