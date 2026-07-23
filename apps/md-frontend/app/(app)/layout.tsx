import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Verify authentication on the server side
  const session = await getServerSession(authOptions);

  // If no session exists, redirect to the login page
  if (!session) {
    redirect("/");
  }

  // If the user is INACTIVE, redirect to the judge application page with an error message
  if (session?.user?.status === "INACTIVE") {
    redirect("/judge-app?error=AccessDenied");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#313338] text-[#DBDEE1]">
      <Sidebar />

      {/* Main content that gets pushed to the right due to sidebar width (ml-64) */}
      <main className="flex-1 overflow-y-auto pt-18.25 md:pt-0">
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
