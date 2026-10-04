// CSV dışa aktarma yardımcıları (İngilizce başlıklar).

export const CSV_COLUMNS = [
  { key: "place_id", header: "place_id", get: (b) => b.place_id, default: true },
  { key: "name", header: "name", get: (b) => b.name, default: true },
  { key: "business_type", header: "business_type", get: (b) => b.business_type, default: true },
  { key: "phone", header: "phone", get: (b) => b.phone, default: true },
  { key: "website", header: "website", get: (b) => b.website, default: true },
  { key: "full_address", header: "full_address", get: (b) => b.full_address, default: true },
  { key: "city", header: "city", get: (b) => b.city, default: true },
  { key: "district", header: "district", get: (b) => b.district, default: true },
  { key: "rating", header: "rating", get: (b) => b.rating, default: true },
  { key: "review_count", header: "review_count", get: (b) => b.review_count, default: true },
  { key: "latitude", header: "latitude", get: (b) => b.lat, default: false },
  { key: "longitude", header: "longitude", get: (b) => b.lng, default: false },
  { key: "google_maps_url", header: "google_maps_url", get: (b) => b.google_maps_url, default: true },
  { key: "cid", header: "cid", get: (b) => b.cid, default: false },
  { key: "plus_code", header: "plus_code", get: (b) => b.plus_code, default: false },
  { key: "working_hours", header: "working_hours", get: (b) => b.working_hours, default: false },
  { key: "image_url", header: "image_url", get: (b) => b.image_url, default: false },
  { key: "detail_status", header: "detail_status", get: (b) => b.detail_status, default: false },
  {
    key: "search_terms",
    header: "search_terms",
    get: (b) => uniqueTerms(b).join(" | "),
    default: true,
  },
  { key: "created_at", header: "created_at", get: (b) => b.created_at, default: false },
  { key: "detailed_at", header: "detailed_at", get: (b) => b.detailed_at, default: false },
];

function uniqueTerms(b) {
  const set = new Set();
  for (const r of b.scan_results || []) {
    if (r.search_term) set.add(r.search_term);
  }
  return [...set];
}

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** İşletme başına tek satır üretir. */
export function buildCsv(businesses, columnKeys) {
  const cols = CSV_COLUMNS.filter((c) => columnKeys.includes(c.key));
  const lines = [cols.map((c) => escapeCell(c.header)).join(",")];
  for (const b of businesses) {
    lines.push(cols.map((c) => escapeCell(c.get(b))).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename, content) {
  // BOM: Excel'de Türkçe karakterlerin doğru görünmesi için
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugifyFilename(name) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return (
    String(name || "project")
      .toLowerCase()
      .replace(/[çğıöşü]/g, (c) => map[c])
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}
