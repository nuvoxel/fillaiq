"use client";

import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user?: { name?: string | null; image?: string | null } | null;
}) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 px-4 md:hidden">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
        </header>
        <div className="flex-1 max-w-[1400px] px-6 py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
