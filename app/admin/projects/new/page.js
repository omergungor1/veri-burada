"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/lib/admin/projects";
import { errorMessage, formatNumber } from "@/lib/admin/format";
import {
  PROVINCES,
  countDistricts,
  generateSearchTerms,
  parseKeywords,
} from "@/lib/admin/keyword-planner";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ErrorBox,
  Field,
  PageHeader,
  SearchInput,
  cx,
  inputClass,
} from "@/components/ui";

const PREVIEW_LIMIT = 200;
const WARN_THRESHOLD = 5000;

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [locationTouched, setLocationTouched] = useState(false);

  const [selected, setSelected] = useState([]); // province id listesi
  const [provinceQuery, setProvinceQuery] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [excludeMerkez, setExcludeMerkez] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const autoLocation = useMemo(
    () =>
      PROVINCES.filter((p) => selectedSet.has(p.id))
        .map((p) => p.name)
        .join(", "),
    [selectedSet],
  );
  const locationValue = locationTouched ? location : autoLocation;

  // Anahtar kelime listesi: textarea boşsa ana anahtar kelime kullanılır.
  const keywords = useMemo(() => {
    const parsed = parseKeywords(keywordsText);
    if (parsed.length > 0) return parsed;
    return parseKeywords(keyword);
  }, [keywordsText, keyword]);

  const terms = useMemo(
    () => generateSearchTerms(keywords, selected, { excludeMerkez }),
    [keywords, selected, excludeMerkez],
  );

  const districtCount = useMemo(
    () => countDistricts(selected, { excludeMerkez }),
    [selected, excludeMerkez],
  );

  const filteredProvinces = useMemo(() => {
    const q = provinceQuery.trim().toLocaleLowerCase("tr");
    if (!q) return PROVINCES;
    return PROVINCES.filter((p) => p.name.toLocaleLowerCase("tr").includes(q));
  }, [provinceQuery]);

  function toggleProvince(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectFiltered() {
    setSelected((prev) => [
      ...new Set([...prev, ...filteredProvinces.map((p) => p.id)]),
    ]);
  }

  function clearSelection() {
    setSelected([]);
  }

  const visibleTerms = terms.slice(0, showAll ? 2000 : PREVIEW_LIMIT);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Proje adı gerekli.");
    if (!keyword.trim()) return setError("Ana anahtar kelime gerekli.");
    if (!locationValue.trim()) return setError("Lokasyon gerekli.");
    if (selected.length === 0) return setError("En az bir il seçin.");
    if (terms.length === 0) return setError("Üretilecek arama terimi yok.");
    if (
      terms.length > WARN_THRESHOLD &&
      !window.confirm(
        `${formatNumber(terms.length)} arama terimi oluşturulacak. Devam edilsin mi?`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await createProject(createClient(), {
        name: name.trim(),
        keyword: keyword.trim(),
        location: locationValue.trim(),
        searchTerms: terms,
      });
      const id = result?.project?.id;
      router.push(id ? `/admin/projects/${id}` : "/admin/projects");
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Yeni proje"
        description="Proje bilgilerini girin, il ve anahtar kelimelerden arama terimlerini üretin."
        actions={
          <ButtonLink href="/admin/projects">Vazgeç</ButtonLink>
        }
      />

      <ErrorBox message={error} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader title="Proje bilgileri" />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Proje adı" htmlFor="name">
                  <input
                    id="name"
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn. Marmara Kuaförler"
                    required
                  />
                </Field>
              </div>
              <Field
                label="Ana anahtar kelime"
                htmlFor="keyword"
                hint="Anahtar kelime listesi boşsa bu kelime kullanılır."
              >
                <input
                  id="keyword"
                  className={inputClass}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Örn. kuaför"
                  required
                />
              </Field>
              <Field
                label="Lokasyon"
                htmlFor="location"
                hint="Seçilen illerden otomatik doldurulur."
              >
                <input
                  id="location"
                  className={inputClass}
                  value={locationValue}
                  onChange={(e) => {
                    setLocationTouched(true);
                    setLocation(e.target.value);
                  }}
                  placeholder="Örn. İstanbul"
                  required
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Anahtar kelimeler"
              subtitle="Her satıra veya virgülle ayırarak bir kelime yazın"
            />
            <div className="space-y-3 p-4">
              <textarea
                className={cx(inputClass, "min-h-28 resize-y")}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder={"kuaför\nberber\ngüzellik salonu"}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={excludeMerkez}
                  onChange={(e) => setExcludeMerkez(e.target.checked)}
                  className="h-4 w-4 accent-green-600"
                />
                &quot;Merkez&quot; ilçelerini hariç tut
              </label>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="İller"
              subtitle={`${selected.length} il seçili · ${formatNumber(districtCount)} ilçe`}
              action={
                <div className="flex gap-2">
                  <Button size="sm" onClick={selectFiltered}>
                    {provinceQuery.trim() ? "Filtrelenenleri seç" : "Tümünü seç"}
                  </Button>
                  <Button size="sm" onClick={clearSelection} disabled={!selected.length}>
                    Temizle
                  </Button>
                </div>
              }
            />
            <div className="p-4">
              <SearchInput
                value={provinceQuery}
                onChange={setProvinceQuery}
                placeholder="İl ara..."
                className="mb-3"
              />
              <div className="thin-scroll grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
                {filteredProvinces.map((p) => {
                  const on = selectedSet.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={cx(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                        on
                          ? "border-green-600 bg-green-600/10 text-green-800 dark:text-green-300"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleProvince(p.id)}
                        className="h-4 w-4 accent-green-600"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  );
                })}
                {filteredProvinces.length === 0 ? (
                  <p className="col-span-full py-4 text-center text-sm text-zinc-500">
                    İl bulunamadı
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        {/* Önizleme */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-20">
            <CardHeader
              title="Önizleme"
              subtitle={`${keywords.length} kelime × ${formatNumber(districtCount)} ilçe`}
            />
            <div className="p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Toplam arama terimi
                </span>
                <span
                  className={cx(
                    "text-2xl font-semibold tabular-nums",
                    terms.length > WARN_THRESHOLD
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400",
                  )}
                >
                  {formatNumber(terms.length)}
                </span>
              </div>
              {terms.length > WARN_THRESHOLD ? (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  Çok fazla arama terimi. Daha az il veya anahtar kelime seçmeyi
                  düşünün.
                </p>
              ) : null}

              {terms.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">
                  İl seçin ve anahtar kelime girin; terimler burada görünecek.
                </p>
              ) : (
                <>
                  <ul className="thin-scroll max-h-96 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
                    {visibleTerms.map((t, i) => (
                      <li
                        key={`${t}-${i}`}
                        className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                  {terms.length > PREVIEW_LIMIT ? (
                    <button
                      type="button"
                      onClick={() => setShowAll((v) => !v)}
                      className="mt-2 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
                    >
                      {showAll
                        ? "İlk 200'ü göster"
                        : `Daha fazla göster (en fazla 2.000)`}
                    </button>
                  ) : null}
                </>
              )}

              <Button
                type="submit"
                variant="primary"
                className="mt-4 w-full"
                disabled={submitting || terms.length === 0}
              >
                {submitting
                  ? "Oluşturuluyor..."
                  : `Projeyi oluştur (${formatNumber(terms.length)} görev)`}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
