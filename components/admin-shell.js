"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/projects", label: "Projeler", icon: "folder" },
  { href: "/admin/queue", label: "Kuyruk", icon: "queue" },
  { href: "/admin/workers", label: "İşçiler", icon: "workers" },
  { href: "/admin/businesses", label: "İşletmeler", icon: "building" },
];

function NavLinks({ pathname, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-green-600/10 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/70",
            )}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 px-4 py-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white">
        <Icon name="building" className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Harita Veri Paneli
      </span>
    </Link>
  );
}

function UserBox({ email, onLogout, loggingOut }) {
  return (
    <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
      <p
        className="mb-2 truncate px-2 text-xs text-zinc-500 dark:text-zinc-400"
        title={email}
      >
        {email}
      </p>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800/70"
      >
        <Icon name="logout" className="h-5 w-5" />
        {loggingOut ? "Çıkış yapılıyor..." : "Çıkış yap"}
      </button>
    </div>
  );
}

export default function AdminShell({ email, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Masaüstü sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-900">
        <Brand />
        <div className="flex-1 overflow-y-auto py-2">
          <NavLinks pathname={pathname} />
        </div>
        <UserBox email={email} onLogout={logout} loggingOut={loggingOut} />
      </aside>

      {/* Mobil drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Menüyü kapat"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <UserBox email={email} onLogout={logout} loggingOut={loggingOut} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Üst bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-3 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="Menüyü aç"
            >
              <Icon name="menu" />
            </button>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Harita Veri Paneli
            </span>
          </div>
          <div className="hidden lg:block" />
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
