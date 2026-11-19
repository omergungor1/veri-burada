// Keyword planner: map-scrapper-extension mantığının web karşılığı.
// Extension: her anahtar kelime × il × ilçe için arama yapar.
// Burada arama terimi: `${keyword} ${district}, ${province.name}`
import { turkiyeIlIlce } from "@/lib/turkiye-il-ilce";

export const PROVINCES = [...turkiyeIlIlce.provinces].sort((a, b) =>
  a.name.localeCompare(b.name, "tr"),
);

const districtsByProvince = new Map();
for (const d of turkiyeIlIlce.districts) {
  if (!districtsByProvince.has(d.province_id)) {
    districtsByProvince.set(d.province_id, []);
  }
  districtsByProvince.get(d.province_id).push(d);
}

export function getDistrictsForProvince(provinceId) {
  return districtsByProvince.get(provinceId) || [];
}

/** Textarea metnini (satır veya virgül ayrımlı) temiz anahtar kelime listesine çevirir. */
export function parseKeywords(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || "").split(/[\n,;]+/)) {
    const k = raw.trim().replace(/\s+/g, " ");
    if (!k) continue;
    const key = k.toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function norm(value) {
  return String(value || "").trim().toLocaleLowerCase("tr");
}

/** "İl / İlçe" seçimleri. İl için seçim yoksa o ilin tüm ilçeleri kalır. */
function allowedDistrict(province, district, options, picked) {
  if (options.excludeMerkez && district.name === "Merkez") return false;
  if (!picked) return true;
  const prefix = `${norm(province.name)} /`;
  const provinceHasPick = picked.some((label) => label.startsWith(prefix));
  if (!provinceHasPick) return true;
  return picked.includes(`${norm(province.name)} / ${norm(district.name)}`);
}

function pickedDistricts(options) {
  const labels = options.districts;
  if (!labels || !labels.length) return null;
  return labels.map((label) => norm(label));
}

/**
 * Arama terimlerini üretir.
 * @param {string[]} keywords
 * @param {number[]} provinceIds
 * @param {{ excludeMerkez?: boolean, districts?: string[] }} options
 */
export function generateSearchTerms(keywords, provinceIds, options = {}) {
  const terms = [];
  const idSet = new Set(provinceIds);
  const provinces = PROVINCES.filter((p) => idSet.has(p.id));
  const picked = pickedDistricts(options);
  for (const keyword of keywords) {
    for (const province of provinces) {
      for (const district of getDistrictsForProvince(province.id)) {
        if (!allowedDistrict(province, district, options, picked)) continue;
        terms.push(`${keyword} ${district.name}, ${province.name}`);
      }
    }
  }
  return terms;
}

export function countDistricts(provinceIds, options = {}) {
  let n = 0;
  const idSet = new Set(provinceIds);
  const picked = pickedDistricts(options);
  for (const province of PROVINCES) {
    if (!idSet.has(province.id)) continue;
    for (const district of getDistrictsForProvince(province.id)) {
      if (!allowedDistrict(province, district, options, picked)) continue;
      n += 1;
    }
  }
  return n;
}

/** Liste talebindeki il adlarını il id listesine çevirir. */
export function provinceIdsForNames(names, allTurkey) {
  if (allTurkey) return PROVINCES.map((p) => p.id);
  const wanted = new Set((names || []).map((name) => norm(name)));
  return PROVINCES.filter((p) => wanted.has(norm(p.name))).map((p) => p.id);
}

/** Liste talebinden proje formunun başlangıç değerleri. */
export function projectSeedFromList(row) {
  const keywords = Array.isArray(row?.keywords)
    ? row.keywords.map((k) => String(k || "").trim()).filter(Boolean)
    : [];
  const allTurkey = Boolean(row?.all_turkey);
  return {
    name: row?.title || "",
    keyword: keywords[0] || "",
    keywordsText: keywords.join("\n"),
    provinceIds: provinceIdsForNames(row?.cities, allTurkey),
    location: allTurkey ? "Tüm Türkiye" : "",
    locationTouched: allTurkey,
    districts: Array.isArray(row?.districts) ? row.districts : [],
  };
}
