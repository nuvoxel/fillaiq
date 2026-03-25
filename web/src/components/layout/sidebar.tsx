"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Warehouse,
  Package,
  BookOpen,
  Printer,
  Router,
  History,
  Send,
  Settings,
  LogOut,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/locations", label: "Dashboard", icon: Warehouse },
  { href: "/spools", label: "Inventory", icon: Package },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/hardware", label: "Hardware", icon: Printer },
  { href: "/scan-station", label: "Stations", icon: Router },
];

const adminItems = [
  { href: "/audit", label: "Audit", icon: History },
  { href: "/submissions", label: "Submissions", icon: Send },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/locations") return pathname === "/locations";
  return pathname.startsWith(href);
}

function FillaLogo() {
  const { state } = useSidebar();
  const expanded = state === "expanded";

  return (
    <div
      className={`flex items-center gap-3 ${
        expanded ? "px-2" : "justify-center"
      } py-2 min-h-14`}
    >
      <div className="flex gap-[3px] shrink-0">
        <div className="w-[5px] h-5 rounded-full bg-cyan-400" />
        <div className="w-[5px] h-5 rounded-full bg-cyan-400" />
      </div>
      {expanded && (
        <span className="font-display font-bold text-white tracking-tight whitespace-nowrap">
          FillaIQ
        </span>
      )}
    </div>
  );
}

function UserProfile({
  user,
}: {
  user: { name?: string | null; image?: string | null };
}) {
  const router = useRouter();
  const { state } = useSidebar();
  const expanded = state === "expanded";

  const initials = user.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  async function handleLogout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className={`flex items-center gap-3 ${
        expanded ? "px-2" : "justify-center"
      } py-3`}
    >
      {user.image ? (
        <img
          src={user.image}
          alt=""
          className="w-8 h-8 rounded-full shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-cyan-400/20 text-cyan-400 flex items-center justify-center text-xs font-semibold shrink-0">
          {initials}
        </div>
      )}
      {expanded && (
        <>
          <div className="flex-1 min-w-0">
            <span className="text-white font-medium text-[0.8125rem] whitespace-nowrap overflow-hidden text-ellipsis block">
              {user.name}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/30 hover:text-red-400 transition-colors p-1"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

export function AppSidebar({
  user,
}: {
  user?: { name?: string | null; image?: string | null; role?: string | null } | null;
}) {
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";

  return (
    <ShadcnSidebar
      collapsible="icon"
      className="bg-[#0F1F23] border-r border-white/[0.06] [&_[data-sidebar=sidebar-inner]]:bg-[#0F1F23]"
    >
      <SidebarHeader className="p-0">
        <FillaLogo />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      tooltip={label}
                      isActive={active}
                      className={
                        active
                          ? "bg-cyan-400/12 text-white hover:bg-cyan-400/16 [&_svg]:text-cyan-400"
                          : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                      }
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarSeparator className="bg-white/[0.08]" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map(({ href, label, icon: Icon }) => {
                    const active = isActive(pathname, href);
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          tooltip={label}
                          isActive={active}
                          className={
                            active
                              ? "bg-cyan-400/12 text-white hover:bg-cyan-400/16 [&_svg]:text-cyan-400"
                              : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                          }
                        >
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-0">
        <SidebarGroup className="p-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      tooltip={label}
                      isActive={active}
                      className={
                        active
                          ? "bg-cyan-400/12 text-white hover:bg-cyan-400/16 [&_svg]:text-cyan-400"
                          : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                      }
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <>
            <SidebarSeparator className="bg-white/[0.08]" />
            <UserProfile user={user} />
          </>
        )}
      </SidebarFooter>

      <SidebarRail />
    </ShadcnSidebar>
  );
}
