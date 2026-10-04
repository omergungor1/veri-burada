// Ortak biçimlendirme yardımcıları ve durum etiketleri.

export const PAGE_SIZE = 25;

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("tr-TR").format(Number(n));
}

export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function timeAgo(value) {
  if (!value) return "hiç";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "-";
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 5) return "şimdi";
  if (sec < 60) return `${sec} sn önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

export function percent(done, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/**
 * İki zaman damgası arasındaki süreyi kısa Türkçe metne çevirir (örn. "1 sa 22 dk").
 * ms < 0 veya geçersizse "-".
 */
export function formatDuration(from, to = Date.now()) {
  if (!from) return "-";
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "-";
  const sec = Math.floor((end - start) / 1000);
  if (sec < 60) return `${sec} sn`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 48) {
    return remMin ? `${hr} sa ${remMin} dk` : `${hr} sa`;
  }
  const day = Math.floor(hr / 24);
  const remHr = hr % 24;
  return remHr ? `${day} g ${remHr} sa` : `${day} g`;
}

/**
 * Proje tarama süresi: created_at → (completed/cancelled ise updated_at, değilse şimdi).
 */
export function projectScanDuration(project) {
  if (!project?.created_at) return "-";
  const ended =
    project.status === "completed" || project.status === "cancelled"
      ? project.updated_at || Date.now()
      : Date.now();
  const label = formatDuration(project.created_at, ended);
  if (label === "-") return "-";
  if (project.status === "completed" || project.status === "cancelled") return label;
  return `${label} (devam)`;
}

// Durum -> { label, tone }
const STATUS_MAP = {
  // projeler
  active: { label: "Aktif", tone: "green" },
  completed: { label: "Tamamlandı", tone: "green" },
  paused: { label: "Duraklatıldı", tone: "amber" },
  cancelled: { label: "İptal", tone: "zinc" },
  // görevler / işler
  pending: { label: "Bekliyor", tone: "amber" },
  claimed: { label: "Alındı", tone: "sky" },
  running: { label: "Çalışıyor", tone: "sky" },
  failed: { label: "Başarısız", tone: "red" },
  // işçiler
  offline: { label: "Çevrimdışı", tone: "zinc" },
  idle: { label: "Boşta", tone: "zinc" },
  working: { label: "Çalışıyor", tone: "green" },
  stopping: { label: "Durduruluyor", tone: "amber" },
  error: { label: "Hata", tone: "red" },
};

export function statusInfo(status) {
  return STATUS_MAP[status] || { label: status || "-", tone: "zinc" };
}

export const TASK_TYPE_LABELS = {
  list: "Liste",
  detail: "Detay",
  max_detail: "Maks. detay",
};

export const WORKER_ACTION_LABELS = {
  pause: "Duraklat",
  resume: "Devam",
  stop_auto: "Otomatik kapat",
  start_auto: "Otomatik aç",
  release_task: "Görevi bırak",
  reset: "Sıfırla",
};

// Supabase hata nesnelerini Türkçe, okunur mesaja çevirir.
const ERROR_MAP = {
  not_authenticated: "Oturum bulunamadı, lütfen tekrar giriş yapın.",
  no_search_terms: "En az bir arama terimi gerekli.",
  worker_not_found: "İşçi bulunamadı.",
};

export function errorMessage(err) {
  if (!err) return "";
  const raw = typeof err === "string" ? err : err.message || String(err);
  for (const key of Object.keys(ERROR_MAP)) {
    if (raw.includes(key)) return ERROR_MAP[key];
  }
  return raw;
}
