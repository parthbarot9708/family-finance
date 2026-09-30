"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const dark = ready && theme === "dark";
  return (
    <button className="icon-btn" aria-label={dark ? "Switch to day mode" : "Switch to night mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? "☀" : "☾"}
    </button>
  );
}
