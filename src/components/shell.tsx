"use client";

import { type ReactNode } from "react";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { Sidebar } from "@/components/sidebar";

/** Applies the main-content offset that matches the desktop sidebar width. */
function Content({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div
      className={`flex-1 min-w-0 transition-all duration-300 ${
        collapsed ? "md:ml-[68px]" : "md:ml-[240px]"
      }`}
    >
      {children}
    </div>
  );
}

/** App shell: sidebar (responsive drawer / rail) + offset main content. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar />
      <Content>{children}</Content>
    </SidebarProvider>
  );
}
