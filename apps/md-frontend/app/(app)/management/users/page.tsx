"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import {
  Search,
  Plus,
  Shield,
  User,
  UserCog,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
} from "lucide-react";

interface DiscordUser {
  discordId: string;
  username: string;
  globalRole: "ADMIN" | "STAFF" | "USER";
  status: "ACTIVE" | "INACTIVE" | "NOT_CONTESTANT";
}

export default function UsersPage() {
  const { data: session, status } = useSession();

  // Cast the role safely from the session
  const userRole = (session?.user as any)?.role || "USER";
  const isAdmin = userRole === "ADMIN";

  // State management
  const [users, setUsers] = useState<DiscordUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New user form state
  const [newUserData, setNewUserData] = useState({
    discordId: "",
    username: "",
    globalRole: "USER",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch users on component mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchUsers();
    }
  }, [session]);

  const fetchUsers = async () => {
    const token = session?.accessToken;

    if (!token) {
      console.error("No access token found in session. User might not be authenticated.");
      setIsLoading(false);
      return;
    }

    console.log("Destino de Axios:", `${process.env.NEXT_PUBLIC_API_BASE_URL}/users`);

    try {
      setIsLoading(true);
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(res.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error("Unauthorized access. Token might be invalid or expired.");
      } else if (error.response?.status === 403) {
        console.error("Forbidden access. User does not have permission to view this resource.");
      } else {
        console.error("An error occurred while fetching users.", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    const token = session?.accessToken;

    if (!token) {
      console.error("No access token found in session. User might not be authenticated.");
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users`, newUserData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Close modal, reset form, and refresh table
      setIsAddModalOpen(false);
      setNewUserData({ discordId: "", username: "", globalRole: "USER" });
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to create user", error);
      alert("Error creating user. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter logic
  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.discordId.includes(searchTerm),
  );

  return (
    <div className="space-y-6 relative">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-[#80848E] text-sm mt-1">
            Manage global roles and view contestant statuses.
          </p>
        </div>

        {/* RBAC: Only ADMIN can see the Add User button */}
        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-md font-medium flex items-center justify-center transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </button>
        )}
      </div>

      {/* Toolbar (Search) */}
      <div className="bg-[#2B2D31] p-4 rounded-t-lg border border-[#1E1F22] flex items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
          <input
            type="text"
            placeholder="Search by username or Discord ID..."
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
            <p>Loading users...</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-[#DBDEE1]">
            <thead className="text-xs text-[#80848E] uppercase bg-[#1E1F22]/50 border-b border-[#1E1F22]">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Discord ID</th>
                <th className="px-6 py-4 font-semibold">Global Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                {/* RBAC: Only ADMIN sees the Actions column */}
                {isAdmin && <th className="px-6 py-4 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr
                    key={user.discordId}
                    className="border-b border-[#1E1F22] hover:bg-[#35373C]/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      {user.username}
                    </td>
                    <td className="px-6 py-4 text-[#80848E] font-mono text-xs">{user.discordId}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          user.globalRole === "ADMIN"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : user.globalRole === "STAFF"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                        }`}
                      >
                        {user.globalRole === "ADMIN" && <Shield className="w-3 h-3 mr-1" />}
                        {user.globalRole === "STAFF" && <UserCog className="w-3 h-3 mr-1" />}
                        {user.globalRole === "USER" && <User className="w-3 h-3 mr-1" />}
                        {user.globalRole}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.status === "ACTIVE" ? "text-emerald-400" : "text-[#80848E]"
                        }`}
                      >
                        {user.status === "ACTIVE" ? (
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-1.5" />
                        )}
                        {user.status}
                      </span>
                    </td>

                    {/* RBAC: Action buttons for ADMIN only */}
                    {isAdmin && (
                      <td className="px-6 py-4 text-right space-x-3">
                        <button className="text-[#5865F2] hover:text-[#4752C4] font-medium transition-colors">
                          Edit
                        </button>
                        <button className="text-red-400 hover:text-red-500 font-medium transition-colors">
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-8 text-center text-[#80848E]">
                    No users found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal Overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2B2D31] rounded-xl border border-[#1E1F22] w-full max-w-md shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#1E1F22]">
              <h2 className="text-lg font-bold text-white">Add New User</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#80848E] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#80848E] uppercase mb-1.5">
                  Discord ID
                </label>
                <input
                  type="text"
                  required
                  value={newUserData.discordId}
                  onChange={(e) => setNewUserData({ ...newUserData, discordId: e.target.value })}
                  className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] rounded-md px-3 py-2 focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] outline-none transition-all"
                  placeholder="e.g. 123456789012345678"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#80848E] uppercase mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] rounded-md px-3 py-2 focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] outline-none transition-all"
                  placeholder="e.g. MicDropKing"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#80848E] uppercase mb-1.5">
                  Global Role
                </label>
                <select
                  value={newUserData.globalRole}
                  onChange={(e) =>
                    setNewUserData({ ...newUserData, globalRole: e.target.value as any })
                  }
                  className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] rounded-md px-3 py-2 focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] outline-none transition-all appearance-none"
                >
                  <option value="USER">USER (Contestant/Judge)</option>
                  <option value="STAFF">STAFF (Organizer)</option>
                  <option value="ADMIN">ADMIN (Full Access)</option>
                </select>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#DBDEE1] hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-md text-sm font-semibold transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSubmitting ? "Saving..." : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
