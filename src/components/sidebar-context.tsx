"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface SidebarContextValue {
  /** Desktop: sidebar collapsed to icon-only rail. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile: off-canvas drawer open. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
