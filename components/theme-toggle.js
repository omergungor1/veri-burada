"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

function subscribe(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export default function ThemeToggle({ className = "" }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={dark ? "Açık tema" : "Koyu tema"}
      className={`rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 ${className}`}
    >
      <Icon name={dark ? "sun" : "moon"} className="h-5 w-5" />
    </button>
  );
}
