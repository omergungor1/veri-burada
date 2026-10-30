import Link from "next/link";
import { LogoWide } from "@/components/logo";
import { Icon } from "@/components/icons";
import { cx } from "@/components/ui";

export function AuthPage({ children }) {
  return (
    <main className="relative min-h-0 flex-1 overflow-y-auto bg-paper">
      <AuthBackdrop />
      <div className="relative mx-auto flex min-h-full w-full max-w-lg items-center justify-center px-4 py-8">
        {children}
      </div>
    </main>
  );
}

export function AuthCard({
  closeHref,
  title,
  text,
  footer,
  children,
  showMap = true,
}) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-border bg-white shadow-xl shadow-forest/5">
      <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
        <LogoWide className="h-8 w-auto max-w-[180px] object-contain object-left" />
        {closeHref ? (
          <Link
            href={closeHref}
            aria-label="Kapat"
            className="rounded-full p-1.5 text-muted hover:bg-pale hover:text-ink"
          >
            <Icon name="close" className="h-5 w-5" />
          </Link>
        ) : (
          <span className="h-8 w-8" />
        )}
      </div>

      <div className="space-y-5 px-5 pb-6 pt-4 sm:px-6 sm:pb-7">
        {showMap ? <AuthMapPreview /> : null}

        {title ? (
          <div className="text-center">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-forest sm:text-[1.85rem]">
              {title}
            </h1>
            {text ? (
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                {text}
              </p>
            ) : null}
          </div>
        ) : null}

        {children}

        {footer ? (
          <p className="text-center text-sm text-muted">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}

export function StepTrack({ step, labels }) {
  return (
    <div>
      <div className="flex gap-1">
        {labels.map((label, i) => (
          <div
            key={label}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              step >= i + 1 ? "bg-green" : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-muted">
        Adım {step} / {labels.length} · {labels[step - 1]}
      </p>
    </div>
  );
}

function AuthBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 1200 800"
        className="h-full w-full object-cover opacity-[0.35]"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="1200" height="800" fill="#f3f7f4" />
        <path
          d="M-20 180C80 160 140 240 260 220C380 200 420 120 560 140C700 160 740 260 880 240C1020 220 1100 140 1240 160"
          fill="none"
          stroke="#cfe3d6"
          strokeWidth="28"
        />
        <path
          d="M-20 420C100 400 180 500 320 470C460 440 520 340 680 360C840 380 900 500 1060 470C1180 450 1240 380 1280 400"
          fill="none"
          stroke="#d7eadf"
          strokeWidth="36"
        />
        <path
          d="M200 -20C220 80 160 160 180 280C200 400 280 440 260 580C240 720 160 760 180 860"
          fill="none"
          stroke="#cfe3d6"
          strokeWidth="22"
        />
        <path
          d="M780 -20C800 100 720 180 760 320C800 460 900 500 880 640C860 780 780 820 800 900"
          fill="none"
          stroke="#d7eadf"
          strokeWidth="26"
        />
        <circle cx="320" cy="250" r="9" fill="#198754" />
        <circle cx="640" cy="360" r="9" fill="#198754" />
        <circle cx="920" cy="220" r="9" fill="#198754" />
      </svg>
      <div className="absolute inset-0 bg-paper/40 backdrop-blur-[2px]" />
    </div>
  );
}

function Pin({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="12" cy="28" rx="6" ry="2.2" fill="#0f4c30" opacity="0.18" />
      <path
        d="M12 1c5.5 0 10 4.3 10 9.7 0 7.2-10 16.3-10 16.3S2 17.9 2 10.7C2 5.3 6.5 1 12 1z"
        fill="#198754"
      />
      <circle cx="12" cy="11" r="3.4" fill="white" />
    </g>
  );
}

export function AuthMapPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#e7f2ea]">
      <svg viewBox="0 0 420 168" className="block h-[148px] w-full sm:h-[160px]">
        <rect width="420" height="168" fill="#e7f2ea" />
        <path
          d="M-10 40C40 32 70 70 130 58C190 46 210 18 270 28C330 38 350 78 420 66"
          fill="none"
          stroke="#c9dece"
          strokeWidth="14"
        />
        <path
          d="M-10 110C50 98 90 130 150 118C210 106 250 74 320 86C370 94 400 120 430 112"
          fill="none"
          stroke="#d5e6d9"
          strokeWidth="18"
        />
        <path
          d="M90 -8C98 30 70 58 82 96C94 134 130 148 118 180"
          fill="none"
          stroke="#c9dece"
          strokeWidth="10"
        />
        <path
          d="M300 -10C312 40 270 70 286 112C302 154 340 168 328 190"
          fill="none"
          stroke="#d5e6d9"
          strokeWidth="12"
        />
        <path
          d="M118 48 C160 42, 210 70, 248 58"
          fill="none"
          stroke="#198754"
          strokeWidth="2"
          strokeDasharray="4 5"
        />
        <Pin x="78" y="28" />
        <Pin x="148" y="58" />
        <Pin x="40" y="92" />
      </svg>

      <div className="absolute right-3 top-4 w-[58%] rounded-xl bg-white p-3 shadow-lg shadow-forest/10 sm:right-4 sm:w-[54%]">
        <p className="mb-2 text-[11px] font-semibold text-ink">
          Hazırlanan listeniz
        </p>
        <ul className="space-y-1.5">
          <PreviewRow label="Atölye Mimarlık" />
          <PreviewRow label="Form Tasarım" />
        </ul>
      </div>
    </div>
  );
}

function PreviewRow({ label }) {
  return (
    <li className="flex items-center justify-between gap-2 text-[11px] text-ink">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-pale text-forest">
          <Icon name="building" className="h-2.5 w-2.5" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-green" />
    </li>
  );
}
