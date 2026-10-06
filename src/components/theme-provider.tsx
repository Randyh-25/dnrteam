"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "theme";
const CHANGE_EVENT = "dnr-theme-change";

/** Reads the persisted theme. `localStorage` is the external store. */
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored ?? "system";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getServerTheme(): Theme {
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // `useSyncExternalStore` avoids a synchronous setState-in-effect and keeps
  // the server snapshot stable for hydration.
  const theme = useSyncExternalStore(subscribe, getStoredTheme, getServerTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (t: "light" | "dark") => {
      root.classList.remove("light", "dark");
      root.classList.add(t);
      setResolvedTheme(t);
    };

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) =>
        applyTheme(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
