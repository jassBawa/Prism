"use client";
import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "prism.theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem(KEY) === "light" ? "light" : "dark";
}

export function setTheme(t: Theme): void {
  localStorage.setItem(KEY, t);
  document.documentElement.setAttribute("data-theme", t);
}

/** Re-apply the persisted theme to <html> (no write). Safe to call on mount. */
export function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", getTheme());
}

/** Current theme + a setter that persists and applies immediately. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setT] = useState<Theme>("dark");
  useEffect(() => setT(getTheme()), []);
  const update = (next: Theme) => {
    setTheme(next);
    setT(next);
  };
  return [theme, update];
}
