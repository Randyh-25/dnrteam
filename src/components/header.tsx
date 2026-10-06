"use client";

import { RefreshCw, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/components/sidebar-context";
import { useState } from "react";

interface HeaderProps {
  lastUpdated?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Header({ lastUpdated, onRefresh, isRefreshing: externalRefreshing }: HeaderProps) {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const isRefreshing = externalRefreshing ?? internalRefreshing;
  const { setMobileOpen } = useSidebar();

  const handleRefresh = async () => {
    setInternalRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setInternalRefreshing(false);
    }
  };

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-background/80 backdrop-blur-md border-b border-border"
      id="header"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors md:hidden"
          aria-label="Open menu"
          id="mobile-menu-button"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">Dashboard</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
            bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
          id="refresh-button"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
