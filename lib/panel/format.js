import { formatDate, formatNumber } from "@/lib/admin/format";
import { PROVINCES } from "@/lib/admin/keyword-planner";

export { formatDate, formatNumber };

export const LIST_STATUS = {
  queued: {
    label: "Sırada",
    tone: "zinc",
    hint: "Talebin alındı. Hazırlık sırasına eklendi.",
  },
  processing: {
    label: "Hazırlanıyor",
    tone: "sky",
    hint: "İşletme verilerini senin için topluyoruz.",
  },
  ready: {
    label: "Hazır",
    tone: "green",
    hint: "Listen hazır! İşletme verilerini keşfedebilirsin.",
  },
  failed: {
    label: "Başarısız",
    tone: "red",
    hint: "Listen hazırlanırken bir sorun oluştu.",
  },
};

export const TX_TYPE_LABELS = {
  purchase: "Kredi Yükleme",
  list_unlock: "Liste Açma",
  admin_adjustment: "Admin Düzeltmesi",
  refund: "İade",
};

export const CREDIT_REQUEST_STATUS = {
  pending: { label: "Bekliyor", tone: "amber" },
  approved: { label: "Onaylandı", tone: "green" },
  cancelled: { label: "İptal", tone: "red" },
};

export function creditRequestStatus(status) {
  return (
    CREDIT_REQUEST_STATUS[status] || {
      label: status || "-",
      tone: "zinc",
    }
  );
}

export function trMobileDigits(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("90")) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("5")) {
    digits = `0${digits}`;
  }
  return digits.slice(0, 11);
}

export function formatTrMobile(raw) {
  const digits = trMobileDigits(raw);
  const parts = [
    digits.slice(0, 4),
    digits.slice(4, 7),
    digits.slice(7, 9),
    digits.slice(9, 11),
  ].filter(Boolean);
  return parts.join(" ");
}

export function isValidTrMobile(raw) {
  return /^05\d{9}$/.test(trMobileDigits(raw));
}

export const USAGE_PURPOSES = [
  "Potansiyel müşteri bulmak",
  "Satış ve pazarlama",
  "Soğuk arama / müşteri kazanımı",
  "E-posta pazarlaması",
  "Pazar araştırması",
  "Rakip analizi",
  "Yazılım veya otomasyon projeleri",
  "Diğer",
];

export const USER_TYPES = [
  "Freelancer",
  "Ajans",
  "Yazılım şirketi",
  "Satış ekibi",
  "Pazarlama ekibi",
  "İşletme sahibi",
  "Kurumsal şirket çalışanı",
  "Diğer",
];

export const MONTHLY_NEEDS = [
  "100'den az",
  "100–1.000",
  "1.000–5.000",
  "5.000–10.000",
  "10.000+",
];

export const PHONE_CODES = [
  "+90",
  "+1",
  "+44",
  "+49",
  "+33",
  "+31",
  "+32",
  "+41",
  "+43",
  "+994",
  "+7",
  "+971",
  "+966",
  "+20",
];

export const ALL_PROVINCE_NAMES = PROVINCES.map((p) => p.name);

export function listStatus(status) {
  return LIST_STATUS[status] || { label: status || "-", tone: "zinc", hint: "" };
}

export function firstName(fullName) {
  const value = String(fullName || "").trim();
  if (!value) return "";
  return value.split(/\s+/)[0];
}

export function suggestListTitle(keywords, cities, allTurkey) {
  const kw = (keywords && keywords[0]) || "İşletme";
  if (allTurkey) return `Türkiye ${kw} Listesi`;
  if (!cities || cities.length === 0) return `${kw} Listesi`;
  if (cities.length === 1) return `${cities[0]} ${kw} Listesi`;
  if (cities.length === 2) return `${cities[0]} ve ${cities[1]} ${kw} Listesi`;
  return `${cities[0]} ve ${cities.length - 1} il ${kw} Listesi`;
}

export function joinList(values, empty = "—") {
  if (!values || !values.length) return empty;
  return values.join(", ");
}

export const REQUEST_TYPE_LABELS = {
  region_list: "Bölge işletme listesi",
  new_openings: "Yeni açılan işletme takibi",
};

export function formatListRegion(row) {
  if (!row) return "—";
  if (row.all_turkey) return "Tüm Türkiye";
  if (row.districts?.length) return joinList(row.districts);
  return joinList(row.cities);
}

export function formatTry(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)} TL`;
}

export function perCreditCost(price, credits) {
  const p = Number(price);
  const c = Number(credits);
  if (!c || !Number.isFinite(p)) return "—";
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(p / c)} TL / kredi`;
}

export function slugifyFilename(name) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return (
    String(name || "liste")
      .toLocaleLowerCase("tr")
      .replace(/[çğıöşü]/g, (ch) => map[ch] || ch)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "liste"
  );
}

export function throwIfError(error) {
  if (error) throw error;
}

export async function rpc(supabase, name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  throwIfError(error);
  return data;
}
