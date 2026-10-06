"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      onClick={cycleTheme}
      className="relative p-2 rounded-lg transition-all duration-200 hover:bg-accent group"
      aria-label={`Current theme: ${theme}. Click to cycle.`}
      id="theme-toggle"
    >
      <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}
