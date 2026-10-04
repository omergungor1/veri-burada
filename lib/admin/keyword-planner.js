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

/**
 * Arama terimlerini üretir.
 * @param {string[]} keywords
 * @param {number[]} provinceIds
 * @param {{ excludeMerkez?: boolean }} options
 */
export function generateSearchTerms(keywords, provinceIds, options = {}) {
  const terms = [];
  const idSet = new Set(provinceIds);
  const provinces = PROVINCES.filter((p) => idSet.has(p.id));
  for (const keyword of keywords) {
    for (const province of provinces) {
      for (const district of getDistrictsForProvince(province.id)) {
        if (options.excludeMerkez && district.name === "Merkez") continue;
        terms.push(`${keyword} ${district.name}, ${province.name}`);
      }
    }
  }
  return terms;
}

export function countDistricts(provinceIds, options = {}) {
  let n = 0;
  for (const id of provinceIds) {
    for (const d of getDistrictsForProvince(id)) {
      if (options.excludeMerkez && d.name === "Merkez") continue;
      n += 1;
    }
  }
  return n;
}
