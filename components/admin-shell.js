"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { LogoMark, LogoWide } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/components/ui";
import { formatNumber } from "@/lib/admin/format";
import NotificationBell from "@/components/notification-bell";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/projects", label: "Projeler", icon: "folder" },
  { href: "/admin/queue", label: "Kuyruk", icon: "queue" },
  { href: "/admin/workers", label: "İşçiler", icon: "workers" },
  { href: "/admin/businesses", label: "İşletmeler", icon: "building" },
  { href: "/admin/customers", label: "Müşteriler", icon: "user" },
  { href: "/admin/list-requests", label: "Liste talepleri", icon: "queue" },
  { href: "/admin/credit-requests", label: "Kredi talepleri", icon: "unlock" },
];

export const CUSTOMER_NAV = [
  { href: "/panel", label: "Genel Bakış", icon: "dashboard", exact: true },
  {
    href: "/panel/listeler",
    label: "Listelerim",
    icon: "queue",
    except: ["/panel/listeler/yeni"],
  },
  { href: "/panel/listeler/yeni", label: "Yeni Liste", icon: "plus" },
  { href: "/panel/krediler", label: "Kredilerim", icon: "unlock" },
  { href: "/panel/hesap", label: "Hesabım", icon: "user" },
  { href: "/panel/ulasin", label: "Bize ulaşın", icon: "mail" },
];

function NavLinks({ pathname, onNavigate, collapsed, nav }) {
  if (!nav.length) return null;
  return (
    <nav className={cx("flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
      {nav.map((item) => {
        const nested =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const excluded = (item.except || []).some(
          (path) => pathname === path || pathname.startsWith(`${path}/`),
        );
        const active = item.exact ? pathname === item.href : nested && !excluded;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center rounded-lg text-sm font-medium transition-colors",
              collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
              active
                ? "bg-pale text-forest"
                : "text-muted hover:bg-pale hover:text-ink",
            )}
          >
            <Icon name={item.icon} className="h-5 w-5 shrink-0" />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              item.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed, homeHref, brandSubtitle }) {
  return (
    <Link
      href={homeHref}
      title={`Veri Burada — ${brandSubtitle}`}
      className={cx(
        "flex py-3",
        collapsed
          ? "items-center justify-center px-2"
          : "flex-col items-start gap-1 px-4",
      )}
    >
      {collapsed ? (
        <>
          <LogoMark className="h-8 w-8 object-contain" />
          <span className="sr-only">Veri Burada {brandSubtitle}</span>
        </>
      ) : (
        <>
          <LogoWide className="h-8 w-auto max-w-full object-contain object-left" />
          <span className="text-[11px] font-medium text-muted">
            {brandSubtitle}
          </span>
        </>
      )}
    </Link>
  );
}

function userHandle(email) {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  return at > 0 ? value.slice(0, at) : value || "Kullanıcı";
}

function CreditChip({ balance, href, collapsed }) {
  if (balance == null || !href) return null;
  if (collapsed) {
    return (
      <Link
        href={href}
        title={`${formatNumber(balance)} Kredi`}
        className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green text-xs font-semibold text-white hover:bg-green-hover"
      >
        +
      </Link>
    );
  }
  return (
    <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg bg-pale px-3 py-2">
      <span className="text-sm font-semibold tabular-nums text-ink">
        {formatNumber(balance)} Kredi
      </span>
      <Link
        href={href}
        aria-label="Kredi yükle"
        className="flex h-7 w-7 items-center justify-center rounded-md bg-green text-white hover:bg-green-hover"
      >
        <Icon name="plus" className="h-4 w-4" />
      </Link>
    </div>
  );
}

function AccountMenu({
  email,
  onLogout,
  loggingOut,
  collapsed = false,
  variant = "sidebar",
  creditBalance,
  creditHref,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const handle = userHandle(email);
  const isHeader = variant === "header";
  const showCredit = creditHref && creditBalance != null;

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cx(
        "relative",
        isHeader ? "" : "border-t border-border",
        isHeader ? "" : collapsed ? "p-2" : "p-3",
      )}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Hesap menüsü"
        title={email}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex items-center rounded-lg text-sm font-medium text-ink hover:bg-pale",
          isHeader
            ? "p-1.5"
            : collapsed
              ? "w-full justify-center px-2 py-2.5"
              : "w-full gap-2.5 px-2 py-2",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pale text-muted">
          <Icon name="user" className="h-4 w-4" />
        </span>
        {isHeader || collapsed ? (
          <span className="sr-only">{handle}</span>
        ) : (
          <span className="min-w-0 truncate">{handle}</span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className={cx(
            "absolute z-50 min-w-[220px] rounded-lg border border-border bg-white py-1 shadow-lg",
            isHeader
              ? "right-0 top-full mt-1"
              : cx(
                  "bottom-full mb-1",
                  collapsed ? "left-full ml-2" : "left-3 right-3",
                ),
          )}
        >
          <p className="truncate px-3 py-2 text-xs text-muted" title={email}>
            {email || "—"}
          </p>
          {showCredit ? (
            <Link
              href={creditHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-ink hover:bg-pale"
            >
              <span className="flex items-center gap-2">
                <Icon name="unlock" className="h-4 w-4" />
                Kredilerim
              </span>
              <span className="tabular-nums font-semibold text-forest">
                {formatNumber(creditBalance)}
              </span>
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-pale disabled:opacity-60"
          >
            <Icon name="logout" className="h-4 w-4" />
            {loggingOut ? "Çıkış yapılıyor..." : "Çıkış yap"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell({
  email,
  children,
  nav = ADMIN_NAV,
  homeHref = "/admin",
  brandSubtitle = "Admin Panel",
  collapseKey = "vb_admin_sidebar_collapsed",
  creditBalance,
  creditHref,
  showNotifications = false,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(collapseKey) === "1");
    } catch {
      /* ignore */
    }
  }, [collapseKey]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(collapseKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function logout() {
    setLoggingOut(true);
    await createClient().auth.signOut();
    router.replace("/giris");
    router.refresh();
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <aside
        className={cx(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-white lg:flex",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        <Brand
          collapsed={collapsed}
          homeHref={homeHref}
          brandSubtitle={brandSubtitle}
        />
        <div className="flex-1 overflow-y-auto py-2">
          <NavLinks pathname={pathname} collapsed={collapsed} nav={nav} />
        </div>
        <CreditChip
          balance={creditBalance}
          href={creditHref}
          collapsed={collapsed}
        />
        <AccountMenu
          email={email}
          onLogout={logout}
          loggingOut={loggingOut}
          collapsed={collapsed}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-2">
              <Brand
                collapsed={false}
                homeHref={homeHref}
                brandSubtitle={brandSubtitle}
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-muted hover:bg-pale"
                aria-label="Menüyü kapat"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <NavLinks
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
                collapsed={false}
                nav={nav}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-white/90 px-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted hover:bg-pale lg:hidden"
              aria-label="Menüyü aç"
            >
              <Icon name="menu" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden rounded-lg p-2 text-muted hover:bg-pale lg:inline-flex"
              aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
              title={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <span className="min-w-0 lg:hidden">
              <LogoWide className="h-7 w-auto max-w-[180px] object-contain object-left" />
              <span className="sr-only">{brandSubtitle}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {showNotifications ? <NotificationBell /> : null}
            <div className="lg:hidden">
              <AccountMenu
                variant="header"
                email={email}
                onLogout={logout}
                loggingOut={loggingOut}
                creditBalance={creditBalance}
                creditHref={creditHref}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-5 sm:px-6 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
