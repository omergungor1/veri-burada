"use client";

import { useEffect, useMemo, useState } from "react";
import geo from "@/data/turkiye-il-ilce";
import { REQUEST_TYPE_LABELS } from "@/lib/panel/format";
import { Button, Card, Field, cx, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";

const PROVINCES = [...geo.provinces].sort((a, b) =>
  a.name.localeCompare(b.name, "tr"),
);

const DISTRICTS_BY_PROVINCE = (() => {
  const map = new Map();
  for (const d of geo.districts) {
    const list = map.get(d.province_id) || [];
    list.push(d);
    map.set(d.province_id, list);
  }
  for (const [id, list] of map) {
    map.set(
      id,
      [...list].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    );
  }
  return map;
})();

const STEPS = [
  { id: 1, label: "İsim" },
  { id: 2, label: "Ürün" },
  { id: 3, label: "Bölge" },
  { id: 4, label: "Sektör" },
  { id: 5, label: "Özet" },
];

const PRODUCTS = [
  {
    id: "new_openings",
    title: "Yeni açılan işletme takibi",
    text: "Seçtiğin bölgelerde yeni açılan işletmeleri izleriz. Liste zaman içinde güncellenir.",
  },
  {
    id: "region_list",
    title: "Seçili bölgedeki işletme listesini al",
    text: "Seçtiğin il ve ilçelerdeki mevcut işletmelerin listesini hazırlarız.",
  },
];

function districtsOf(provinceId) {
  return DISTRICTS_BY_PROVINCE.get(provinceId) || [];
}

function regionChip(region) {
  if (!region.districtIds.length) return region.provinceName;
  if (region.districtNames.length === 1) {
    return `${region.provinceName} / ${region.districtNames[0]}`;
  }
  return `${region.provinceName} · ${region.districtNames.length} ilçe`;
}

function districtLabels(regions) {
  const out = [];
  for (const r of regions) {
    if (!r.districtIds.length) continue;
    for (const name of r.districtNames) {
      out.push(`${r.provinceName} / ${name}`);
    }
  }
  return out;
}

export default function ListRequestForm({
  onSubmit,
  onStepChange,
  submitting = false,
  submitLabel = "Liste Talebi Oluştur",
  extraActions,
  compact = false,
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [requestType, setRequestType] = useState("");
  const [allTurkey, setAllTurkey] = useState(false);
  const [regions, setRegions] = useState([]);
  const [activeProvinceId, setActiveProvinceId] = useState(null);
  const [placeTab, setPlaceTab] = useState("province");
  const [placeQuery, setPlaceQuery] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    onStepChange?.(step);
  }, [onStepChange, step]);

  const cityNames = useMemo(
    () => (allTurkey ? PROVINCES.map((p) => p.name) : regions.map((r) => r.provinceName)),
    [allTurkey, regions],
  );

  const filteredProvinces = useMemo(() => {
    const q = placeQuery.trim().toLocaleLowerCase("tr");
    if (!q) return PROVINCES;
    return PROVINCES.filter((p) => p.name.toLocaleLowerCase("tr").includes(q));
  }, [placeQuery]);

  const activeProvince = useMemo(
    () => PROVINCES.find((p) => p.id === activeProvinceId) || null,
    [activeProvinceId],
  );

  const filteredDistricts = useMemo(() => {
    if (!activeProvince) return [];
    const list = districtsOf(activeProvince.id);
    const q = placeQuery.trim().toLocaleLowerCase("tr");
    if (!q) return list;
    return list.filter((d) => d.name.toLocaleLowerCase("tr").includes(q));
  }, [activeProvince, placeQuery]);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.provinceId === activeProvinceId) || null,
    [regions, activeProvinceId],
  );

  function flushDraft() {
    const value = String(draft || "").trim().replace(/\s+/g, " ");
    if (!value) return keywords;
    const key = value.toLocaleLowerCase("tr");
    if (keywords.some((k) => k.toLocaleLowerCase("tr") === key) || keywords.length >= 10) {
      setDraft("");
      return keywords;
    }
    const next = [...keywords, value];
    setKeywords(next);
    setDraft("");
    return next;
  }

  function stepError(n, kws = keywords) {
    if (n === 1 && title.trim().length < 2) return "Listeye en az 2 karakterlik bir ad ver.";
    if (n === 2 && !requestType) return "Bir ürün seç.";
    if (n === 3 && !allTurkey && !regions.length) {
      return "Tüm Türkiye’yi seç veya en az bir il ekle.";
    }
    if (n === 4 && !kws.length) return "En az bir sektör / arama terimi ekle.";
    return "";
  }

  function goNext() {
    const kws = step === 4 ? flushDraft() : keywords;
    const msg = stepError(step, kws);
    if (msg) {
      setFormError(msg);
      return;
    }
    setFormError("");
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setFormError("");
    setStep((s) => Math.max(1, s - 1));
  }

  function addKeyword(raw) {
    const value = String(raw || "").trim().replace(/\s+/g, " ");
    if (!value) return;
    const key = value.toLocaleLowerCase("tr");
    if (keywords.some((k) => k.toLocaleLowerCase("tr") === key)) return;
    if (keywords.length >= 10) return;
    setKeywords((prev) => [...prev, value]);
    setDraft("");
  }

  function onKeywordKey(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(draft);
    }
    if (e.key === "Backspace" && !draft && keywords.length) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  }

  function selectAllTurkey() {
    setAllTurkey(true);
    setRegions([]);
    setActiveProvinceId(null);
    setPlaceTab("province");
  }

  function addProvince(province) {
    setAllTurkey(false);
    setActiveProvinceId(province.id);
    setRegions((prev) => {
      if (prev.some((r) => r.provinceId === province.id)) return prev;
      return [
        ...prev,
        {
          provinceId: province.id,
          provinceName: province.name,
          districtIds: [],
          districtNames: [],
        },
      ];
    });
  }

  function removeRegion(provinceId) {
    setRegions((prev) => prev.filter((r) => r.provinceId !== provinceId));
    if (activeProvinceId === provinceId) setActiveProvinceId(null);
  }

  function toggleDistrict(district) {
    if (!activeProvince) return;
    setAllTurkey(false);
    setRegions((prev) => {
      const current = prev.find((r) => r.provinceId === activeProvince.id);
      const base = current || {
        provinceId: activeProvince.id,
        provinceName: activeProvince.name,
        districtIds: [],
        districtNames: [],
      };
      const on = base.districtIds.includes(district.id);
      const nextIds = on
        ? base.districtIds.filter((id) => id !== district.id)
        : [...base.districtIds, district.id];
      const nextNames = on
        ? base.districtNames.filter((n) => n !== district.name)
        : [...base.districtNames, district.name];
      const next = { ...base, districtIds: nextIds, districtNames: nextNames };
      const others = prev.filter((r) => r.provinceId !== activeProvince.id);
      return [...others, next];
    });
  }

  async function saveRequest() {
    const msg = stepError(1) || stepError(2) || stepError(3) || stepError(4);
    if (msg) {
      setFormError(msg);
      return;
    }
    setFormError("");
    await onSubmit?.({
      title: title.trim(),
      keywords,
      cities: cityNames,
      allTurkey,
      requestType,
      districts: districtLabels(regions),
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (step < 5) goNext();
  }

  const primaryButton =
    step < 5 ? (
      <Button
        key="next"
        type="button"
        variant="primary"
        size="lg"
        className="min-h-12 min-w-0 flex-1 rounded-xl font-semibold shadow-md shadow-green/25"
        onClick={goNext}
      >
        Devam et
      </Button>
    ) : (
      <Button
        key="confirm"
        type="button"
        variant="primary"
        size="lg"
        disabled={submitting}
        className="min-h-12 min-w-0 flex-1 rounded-xl px-4 font-semibold shadow-md shadow-green/25"
        onClick={saveRequest}
      >
        <Icon name="plus" className="h-5 w-5 shrink-0" />
        <span className="truncate">
          {submitting ? "Kaydediliyor..." : submitLabel}
        </span>
      </Button>
    );

  return (
    <form
      onSubmit={handleSubmit}
      className={cx(
        "space-y-5",
        !compact && "pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0",
      )}
    >
      {compact ? null : (
        <div>
          <div className="flex gap-1">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={cx(
                  "h-1.5 flex-1 rounded-full",
                  step >= s.id ? "bg-green" : "bg-border",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-muted">
            Adım {step} / {STEPS.length} · {STEPS[step - 1].label}
          </p>
        </div>
      )}

      {formError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {formError}
        </p>
      ) : null}

      {step === 1 ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink">Bu listeye bir isim ver</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Örn. Antalya Kuaför Listesi. İstediğin zaman değiştirebilirsin.
          </p>
          <Field label="Liste adı">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Liste adı"
              className={inputClass}
            />
          </Field>
        </Card>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Nasıl bir liste istiyorsun?</h2>
          <p className="text-sm text-muted">İki üründen birini seç.</p>
          {PRODUCTS.map((p) => {
            const on = requestType === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setRequestType(p.id)}
                className={cx(
                  "w-full rounded-xl border p-4 text-left transition-colors",
                  on
                    ? "border-green bg-pale ring-2 ring-green"
                    : "border-border bg-white hover:bg-pale",
                )}
              >
                <p className="font-semibold text-ink">{p.title}</p>
                <p className="mt-1 text-sm text-muted">{p.text}</p>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Bölge seç</h2>
          <p className="text-sm text-muted">
            Tüm Türkiye, bir veya birden fazla il; istersen ilçe de ekleyebilirsin.
          </p>

          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex items-center gap-1 border-b border-border px-2">
              <Icon name="search" className="ml-1 h-4 w-4 shrink-0 text-muted" />
              {(
                [
                  { key: "province", label: "İl" },
                  { key: "district", label: "İlçe / Semt" },
                ]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  disabled={allTurkey && tab.key === "district"}
                  onClick={() => {
                    setPlaceTab(tab.key);
                    setPlaceQuery("");
                  }}
                  className={cx(
                    "shrink-0 px-2 py-3 text-sm font-medium",
                    placeTab === tab.key
                      ? "border-b-2 border-forest text-forest"
                      : "text-muted hover:text-ink",
                    allTurkey && tab.key === "district" ? "opacity-40" : "",
                  )}
                >
                  {tab.label}
                </button>
              ))}
              <input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder={placeTab === "province" ? "İl ara" : "İlçe ara"}
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"
              />
            </div>

            <div
              className={cx(
                "max-h-56 overflow-y-auto py-1",
                compact ? "max-h-44" : "max-h-56",
              )}
            >
              {placeTab === "province" ? (
                <>
                  <button
                    type="button"
                    onClick={selectAllTurkey}
                    className={cx(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm",
                      allTurkey ? "bg-pale text-forest" : "hover:bg-pale",
                    )}
                  >
                    Tüm Türkiye
                    {allTurkey ? <Icon name="check" className="h-4 w-4" /> : null}
                  </button>
                  {filteredProvinces.map((p) => {
                    const on = !allTurkey && regions.some((r) => r.provinceId === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProvince(p)}
                        className={cx(
                          "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm",
                          on ? "bg-pale text-forest" : "hover:bg-pale",
                        )}
                      >
                        {p.name}
                        {on ? <Icon name="check" className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  {!activeProvince ? (
                    <p className="px-4 py-3 text-sm text-muted">
                      İlçe seçmek için önce bir il ekle.
                    </p>
                  ) : (
                    <>
                      <p className="px-4 py-2 text-xs font-medium text-muted">
                        {activeProvince.name} ilçeleri
                      </p>
                      {filteredDistricts.map((d) => {
                        const on = selectedRegion?.districtIds.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleDistrict(d)}
                            className={cx(
                              "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm",
                              on ? "bg-pale text-forest" : "hover:bg-pale",
                            )}
                          >
                            {d.name}
                            {on ? <Icon name="check" className="h-4 w-4" /> : null}
                          </button>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {allTurkey ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-pale px-2.5 py-1 text-sm text-forest">
                Tüm Türkiye
                <button
                  type="button"
                  aria-label="Tüm Türkiye seçimini kaldır"
                  onClick={() => setAllTurkey(false)}
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              </span>
            ) : (
              regions.map((r) => (
                <button
                  key={r.provinceId}
                  type="button"
                  onClick={() => {
                    setActiveProvinceId(r.provinceId);
                    setPlaceTab("district");
                  }}
                  className={cx(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm",
                    activeProvinceId === r.provinceId
                      ? "bg-green text-white"
                      : "bg-pale text-forest",
                  )}
                >
                  {regionChip(r)}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`${r.provinceName} seçimini kaldır`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRegion(r.provinceId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        removeRegion(r.provinceId);
                      }
                    }}
                  >
                    <Icon name="close" className="h-3 w-3" />
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="text-xs text-muted">
            {allTurkey
              ? "81 il seçildi."
              : regions.length
                ? `${regions.length} il seçildi. İlçeleri daraltmak için bir ile dokun.`
                : "Henüz bölge seçilmedi."}
          </p>
        </div>
      ) : null}

      {step === 4 ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink">Sektör / arama terimleri</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Kuaför, berber, oto servis gibi terimler yazıp Enter’a bas. En fazla 10.
          </p>
          <Field hint={`${keywords.length}/10 arama terimi.`}>
            <div className="rounded-lg border border-border bg-white px-2 py-2 focus-within:border-green focus-within:ring-2 focus-within:ring-green/20">
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-full bg-pale px-2.5 py-1 text-sm text-forest"
                  >
                    {k}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-pale"
                      aria-label={`${k} terimini sil`}
                      onClick={() =>
                        setKeywords((prev) => prev.filter((x) => x !== k))
                      }
                    >
                      <Icon name="close" className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeywordKey}
                  onBlur={() => addKeyword(draft)}
                  placeholder={keywords.length ? "" : "Kuaför, berber, oto servis…"}
                  className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
                  disabled={keywords.length >= 10}
                />
              </div>
            </div>
          </Field>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card className="space-y-3 bg-pale p-5 text-sm">
          <h2 className="text-lg font-semibold text-ink">Talep özeti</h2>
          <p>
            <span className="text-muted">Liste adı: </span>
            {title.trim() || "—"}
          </p>
          <p>
            <span className="text-muted">Ürün: </span>
            {REQUEST_TYPE_LABELS[requestType] || "—"}
          </p>
          <p>
            <span className="text-muted">Bölgeler: </span>
            {allTurkey
              ? "Tüm Türkiye"
              : regions.length
                ? regions.map(regionChip).join(", ")
                : "—"}
          </p>
          <p>
            <span className="text-muted">Arama terimleri: </span>
            {keywords.length ? keywords.join(", ") : "—"}
          </p>
          <p>
            <span className="text-muted">Tahmini hazırlanma: </span>
            Yaklaşık 1 iş günü
          </p>
          <p className="text-muted">
            Liste oluşturmak ücretsizdir. Yalnızca listenin tamamını açmak
            istediğinde kredi kullanırsın.
          </p>
        </Card>
      ) : null}

      <div
        className={cx(
          compact
            ? "flex flex-col gap-3 pt-2"
            : "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:pt-2 md:pb-0 md:backdrop-blur-none",
        )}
      >
        <div className="mx-auto flex w-full max-w-md items-stretch gap-2">
          {step > 1 ? (
            <Button
              type="button"
              size="lg"
              disabled={submitting}
              onClick={goBack}
              className="min-h-12 min-w-[5.5rem] shrink-0 rounded-xl px-5"
            >
              Geri
            </Button>
          ) : null}
          {primaryButton}
        </div>
        {extraActions && step === 1 ? (
          <div className="mx-auto flex w-full max-w-md justify-center">
            {extraActions}
          </div>
        ) : null}
      </div>
    </form>
  );
}
