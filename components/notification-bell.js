"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  dismissNotification,
  loadNotifications,
  markNotificationRead,
} from "@/lib/panel/api";
import { timeAgo } from "@/lib/admin/format";
import { Icon } from "@/components/icons";
import { cx } from "@/components/ui";

function safeHref(href) {
  if (!href || typeof href !== "string") return null;
  if (href.startsWith("/") && !href.startsWith("//")) return { kind: "internal", href };
  if (href.startsWith("https://")) return { kind: "external", href };
  return null;
}

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await loadNotifications(createClient());
      setItems(data);
      setError("");
    } catch (err) {
      setError(err?.message || "Bildirimler yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

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

  const unread = items.filter((item) => !item.read_at).length;

  async function openItem(item) {
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, read_at: row.read_at || new Date().toISOString() } : row,
      ),
    );
    setOpen(false);
    const target = safeHref(item.href);
    try {
      await markNotificationRead(createClient(), item.id);
    } catch (err) {
      setError(err?.message || "Bildirim okundu olarak işaretlenemedi.");
      setOpen(true);
    }
    if (!target) return;
    if (target.kind === "external") {
      window.open(target.href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(target.href);
  }

  async function removeItem(item) {
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    try {
      await dismissNotification(createClient(), item.id);
    } catch (err) {
      setError(err?.message || "Bildirim silinemedi.");
      load();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
        onClick={() => {
          setOpen((value) => !value);
          load();
        }}
        className="relative rounded-lg p-2 text-muted hover:bg-pale hover:text-ink"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-green px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className="absolute right-0 top-full z-50 mt-1 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-white shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Bildirimler</p>
          </div>
          {error ? (
            <p className="px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Bildirim yok.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => {
                const unreadItem = !item.read_at;
                return (
                  <li key={item.id} className="border-b border-border last:border-b-0">
                    <div className={cx("flex items-start gap-1", unreadItem ? "bg-pale" : "bg-white")}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-pale"
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className={cx(
                              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              unreadItem ? "bg-green" : "bg-transparent",
                            )}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span
                              className={cx(
                                "block text-sm text-ink",
                                unreadItem ? "font-semibold" : "font-medium",
                              )}
                            >
                              {item.title}
                            </span>
                            {item.body ? (
                              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                                {item.body}
                              </span>
                            ) : null}
                            <span className="mt-1 block text-[11px] text-muted">
                              {timeAgo(item.created_at)}
                            </span>
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Bildirimi sil"
                        title="Sil"
                        onClick={() => removeItem(item)}
                        className="mr-1 mt-2 rounded-md p-1 text-muted hover:bg-white hover:text-ink"
                      >
                        <Icon name="close" className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
