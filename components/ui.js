"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { formatNumber, statusInfo } from "@/lib/admin/format";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------- Kart ------------------------------- */

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------ Butonlar ----------------------------- */

const BUTTON_VARIANTS = {
  primary:
    "bg-green-600 text-white hover:bg-green-700 focus-visible:outline-green-600 disabled:bg-green-600/50",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
};

const BUTTON_SIZES = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export function buttonClass(variant = "secondary", size = "md", className) {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...rest}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/* ------------------------------ Form -------------------------------- */

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className }) {
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
        <Icon name="search" className="h-4 w-4" />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(inputClass, "pl-9")}
      />
    </div>
  );
}

/* ------------------------------ Rozetler ----------------------------- */

const TONES = {
  green:
    "bg-green-100 text-green-800 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30",
  amber:
    "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  sky: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30",
  red: "bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600/40",
};

export function Badge({ tone = "zinc", children, className }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }) {
  const info = statusInfo(status);
  return <Badge tone={info.tone}>{label || info.label}</Badge>;
}

/* --------------------------- Durum bileşenleri ----------------------- */

export function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg
      className={cx("animate-spin text-green-600", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Yükleniyor"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoadingBlock({ label = "Yükleniyor..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500 dark:text-zinc-400">
      <Spinner />
      {label}
    </div>
  );
}

export function EmptyState({ title = "Kayıt bulunamadı", description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    >
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium underline"
        >
          Tekrar dene
        </button>
      ) : null}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "green"
      ? "text-green-600 dark:text-green-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "red"
          ? "text-red-600 dark:text-red-400"
          : "text-zinc-900 dark:text-zinc-50";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums", toneClass)}>
        {typeof value === "number" ? formatNumber(value) : (value ?? "-")}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </Card>
  );
}

export function ProgressBar({ value, className }) {
  return (
    <div
      className={cx(
        "h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-green-600 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/** Liste / detay gibi tek bir tarama fazının kompakt ilerleme hücresi. */
export function PhaseProgress({
  label,
  completed = 0,
  failed = 0,
  total = 0,
  emptyLabel = "Henüz yok",
  className,
}) {
  const done = completed + failed;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className={cx("min-w-[148px]", className)}>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
          {total > 0 ? `%${pct}` : "—"}
        </span>
      </div>
      <ProgressBar value={total > 0 ? pct : 0} />
      <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
        {total > 0 ? (
          <>
            {formatNumber(completed)}/{formatNumber(total)} ok
            {failed > 0 ? (
              <span className="text-red-600 dark:text-red-400">
                {" "}
                · {formatNumber(failed)} hata
              </span>
            ) : null}
          </>
        ) : (
          emptyLabel
        )}
      </p>
    </div>
  );
}

/* ------------------------------- Tablo ------------------------------- */

/** Yatay kaydırılabilir tablo sarmalayıcısı. */
export function TableWrap({ children }) {
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }) {
  return (
    <th
      className={cx(
        "whitespace-nowrap bg-zinc-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }) {
  return (
    <td
      className={cx(
        "border-t border-zinc-100 px-4 py-2.5 align-middle text-zinc-700 dark:border-zinc-800 dark:text-zinc-300",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Pagination({ page, pageSize, count, onChange }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(count, (page + 1) * pageSize);
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 text-sm sm:flex-row dark:border-zinc-800">
      <span className="text-zinc-500 dark:text-zinc-400">
        {formatNumber(from)}–{formatNumber(to)} / {formatNumber(count)}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
          Önceki
        </Button>
        <span className="min-w-16 text-center text-zinc-600 dark:text-zinc-300">
          {page + 1} / {pages}
        </span>
        <Button
          size="sm"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        >
          Sonraki
          <Icon name="chevronRight" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange, counts }) {
  return (
    <div className="thin-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cx(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-green-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {t.label}
            {counts && counts[t.key] !== undefined ? (
              <span
                className={cx(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  isActive
                    ? "bg-white/20"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                )}
              >
                {formatNumber(counts[t.key])}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------- Modal ------------------------------- */

export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl sm:max-w-lg sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Kapat"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Anahtar-değer ayrıntı satırı */
export function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-3 sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-zinc-900 sm:col-span-2 dark:text-zinc-100">
        {children ?? "-"}
      </dd>
    </div>
  );
}

/**
 * Satır sonu ⋮ menü.
 * items: [{ key, label, onClick, disabled?, tone?: 'default'|'danger' }]
 */
export function ActionMenu({ items = [], align = "right", label = "İşlemler" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <Icon name="more" className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cx(
            "absolute z-30 mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                if (!item.disabled) item.onClick?.();
              }}
              className={cx(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40",
                item.tone === "danger"
                  ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800",
              )}
            >
              {item.icon ? <Icon name={item.icon} className="h-4 w-4 shrink-0" /> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
