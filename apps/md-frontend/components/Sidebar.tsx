"use client";

import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Mic2,
  Users,
  Settings,
  LogOut,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Home,
  Gavel,
  Disc3,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Accordion state
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    Management: true,
  });

  // Sidebar open/close state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close the sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const toggleAccordion = (name: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Fetch user role from session and conditionally render links based on role
  const userRole = session?.user?.role || "USER";

  const menuItems = [
    {
      name: "Home",
      href: "/home",
      icon: Home,
      roles: ["ADMIN", "STAFF", "USER"],
    },
    {
      name: "My Rounds",
      href: "/my-rounds",
      icon: Mic2,
      roles: ["ADMIN", "STAFF", "USER"],
    },
    {
      name: "Collection",
      href: "/collection",
      icon: Disc3,
      roles: ["ADMIN", "STAFF", "USER"],
    },
    {
      name: "Judge App",
      href: "/judge-app",
      icon: Gavel,
      roles: ["ADMIN", "STAFF", "USER"],
    },
    {
      name: "Management",
      href: "/management",
      icon: LayoutDashboard,
      roles: ["ADMIN", "STAFF"],
      subitems: [
        { name: "Users", href: "/management/users", icon: Users, roles: ["ADMIN", "STAFF"] },
        { name: "Rounds", href: "/management/rounds", icon: Mic2, roles: ["ADMIN", "STAFF"] },
      ],
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      roles: ["ADMIN"],
    },
  ];

  // Filter menu items based on user role
  const allowedMenu = menuItems.filter((item) => item.roles.includes(userRole));

  const handleSignOut = async () => {
    if (session?.user?.discordId) {
      try {
        // Inform backend about logout for cleanup of refresh token
        await api.post("/auth/signout", {
          discordId: session.user.discordId,
        });
      } catch (error) {
        // Even if this fails, we still want to sign out on the client side, so we catch errors silently
        console.error("Error during sign out:", error);
      }
    }

    await signOut({ callbackUrl: "/" });
  };

  return (
    <>
      {/* Sidebar toggle button */}
      <div className="md:hidden flex items-center justify-between bg-[#1E1F22] p-4 text-[#DBDEE1] w-full fixed top-0 left-0 z-40 border-b border-[#35373C]">
        <div className="flex items-center">
          <Mic2 className="w-6 h-6 text-[#5865F2] mr-3" />
          <span className="text-white font-bold text-sm tracking-wide">MicDrop</span>
          {userRole === "ADMIN" && (
            <span title="Admin mode" className="ml-4 flex items-center">
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="focus:outline-none text-[#DBDEE1] p-1 rounded-md hover:bg-[#35373C] transition-colors"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 z-40 transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`w-64 bg-[#2B2D31] text-[#DBDEE1] flex flex-col h-screen fixed left-0 top-0 z-50 transform transition-transform duration-300 ease-in-out 
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 md:relative md:shrink-0`}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center px-6 border-b border-[#1E1F22] shadow-sm">
          <Mic2 className="w-6 h-6 text-[#5865F2] mr-3" />
          <span className="text-white font-bold text-lg tracking-wide">MicDrop</span>
          {userRole === "ADMIN" && (
            <span title="Admin mode" className="ml-auto flex items-center">
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allowedMenu.map((item) => {
            const Icon = item.icon;

            // If the item has subitems, render an accordion
            if (item.subitems) {
              const allowedSubitems = item.subitems.filter((sub) => sub.roles.includes(userRole));

              // highlight parent if any subitem is active or if parent itself is active
              const isAnySubActive = allowedSubitems.some((sub) => pathname.startsWith(sub.href));
              const isExactParentActive = pathname === item.href;
              const isHighlighted = isAnySubActive || isExactParentActive;

              // Check if this specific accordion is open
              const isOpen = openAccordions[item.name] || false;

              return (
                <div key={item.name} className="flex flex-col space-y-1">
                  <button
                    onClick={() => toggleAccordion(item.name)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-md transition-colors w-full ${
                      isHighlighted
                        ? "bg-[#35373C] text-white"
                        : "hover:bg-[#35373C] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="w-5 h-5 mr-3 text-[#80848E]" />
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#80848E]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#80848E]" />
                    )}
                  </button>

                  {/* Subitems */}
                  {isOpen && (
                    <div className="pl-6 space-y-1 mt-1">
                      {allowedSubitems.map((sub) => {
                        const isSubActive = pathname.startsWith(sub.href);
                        const SubIcon = sub.icon;

                        return (
                          <Link
                            key={sub.name}
                            href={sub.href}
                            className={`flex items-center px-3 py-2 rounded-md transition-colors ${
                              isSubActive
                                ? "bg-[#404249] text-white"
                                : "hover:bg-[#35373C] text-[#80848E] hover:text-[#DBDEE1]"
                            }`}
                          >
                            <SubIcon className="w-4 h-4 mr-3" />
                            <span className="font-medium text-sm">{sub.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular menu item
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-md transition-colors group ${
                  isActive ? "bg-[#404249] text-white" : "hover:bg-[#35373C] hover:text-white"
                }`}
              >
                <Icon
                  className={`w-5 h-5 mr-3 ${isActive ? "text-white" : "text-[#80848E] group-hover:text-[#DBDEE1]"}`}
                />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile and sign out */}
        <div className="p-4 bg-[#232428] flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            {session?.user?.image ? (
              <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full mr-3" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#5865F2] mr-3 flex items-center justify-center text-white font-bold">
                {session?.user?.name?.charAt(0) || "U"}
              </div>
            )}
            <div className="flex flex-col truncate">
              <span className="text-white text-sm font-semibold truncate">
                {session?.user?.name || "User"}
              </span>
              <span className="text-xs text-[#80848E] truncate">{userRole}</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="p-2 text-[#80848E] hover:text-red-400 hover:bg-[#313338] rounded-md transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>
    </>
  );
}
