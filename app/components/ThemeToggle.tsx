"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/** One-tap dark/light switch. Lives in the sidebar foot for easy access. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="side-action"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun width={17} height={17} /> : <Moon width={17} height={17} />}
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
