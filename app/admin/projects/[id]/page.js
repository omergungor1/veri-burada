"use client";

import { use, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData, useDebounced } from "@/lib/admin/hooks";
import {
  fetchDetailProgressByProject,
  getProject,
  getProjectBusinesses,
  getProjectFirstScan,
  getProjectErrors,
  getProjectTaskCounts,
  getProjectTasks,
  pauseProject,
  resumeProject,
  summarizeProjectProgress,
} from "@/lib/admin/projects";
import {
  PAGE_SIZE,
  TASK_TYPE_LABELS,
  formatDate,
  formatNumber,
} from "@/lib/admin/format";
import {
  BackLink,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  inputClass,
  Modal,
  PageHeader,
  Pagination,
  PhaseProgress,
  SearchInput,
  StatCard,
  StatusBadge,
  Tabs,
  Td,
  TableWrap,
  Th,
  cx,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import ExportModal from "@/components/export-modal";

const LOCATION_LIMIT = 72;

function shortenLocation(location) {
  const text = String(location || "").trim();
  if (text.length <= LOCATION_LIMIT) return { shown: text, long: false };
  const cut = text.slice(0, LOCATION_LIMIT);
  const comma = cut.lastIndexOf(",");
  const shown = (comma > 24 ? cut.slice(0, comma) : cut).trim();
  return { shown, long: true };
}

const TABS = [
  { key: "tasks", label: "Arama terimleri" },
  { key: "businesses", label: "İşletmeler" },
  { key: "errors", label: "Hatalar" },
];

const TASK_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "pending", label: "Bekleyen" },
  { key: "running", label: "Çalışan" },
  { key: "completed", label: "Tamamlanan" },
  { key: "failed", label: "Başarısız" },
];

export default function ProjectDetailPage({ params }) {
  const { id } = use(params);
  const [tab, setTab] = useState("tasks");
  const [exportOpen, setExportOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);

  const { data, error, loading, reload } = useAsyncData(
    async () => {
      const supabase = createClient();
      const project = await getProject(supabase, id);
      if (!project) return { project: null };
      const jobIds = (project.scan_jobs || []).map((j) => j.id);
      const [counts, detailByProject, firstScan] = await Promise.all([
        getProjectTaskCounts(supabase, jobIds),
        fetchDetailProgressByProject(supabase, [project]),
        getProjectFirstScan(supabase, jobIds),
      ]);
      const progress = summarizeProjectProgress(project, detailByProject[project.id]);
      return { project, jobIds, counts, progress, firstScan };
    },
    [id],
  );

  async function onToggleProjectStatus() {
    if (!data?.project || statusBusy) return;
    const status = data.project.status;
    if (status !== "active" && status !== "paused") return;

    setStatusBusy(true);
    setStatusError("");
    try {
      const supabase = createClient();
      if (status === "active") await pauseProject(supabase, id);
      else await resumeProject(supabase, id);
      await reload();
    } catch (e) {
      setStatusError(e?.message || "Proje durumu güncellenemedi");
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading && !data) return <LoadingBlock />;

  if (data && !data.project) {
    return (
      <>
        <PageHeader
          title="Proje bulunamadı"
          leading={<BackLink href="/admin/projects" label="Projelere dön" />}
        />
        <Card>
          <EmptyState title="Proje bulunamadı" />
        </Card>
      </>
    );
  }

  const project = data?.project;
  const jobIds = data?.jobIds || [];
  const counts = data?.counts || {};
  const list = data?.progress?.list || {
    total: 0,
    completed: 0,
    failed: 0,
    found: 0,
    done: 0,
  };
  const detail = data?.progress?.detail || {
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    active: 0,
    done: 0,
  };
  const canPause = project?.status === "active";
  const canResume = project?.status === "paused";
  const locationText = shortenLocation(project?.location);
  const locationPlaces = String(project?.location || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <>
      <ErrorBox message={error || statusError} onRetry={reload} />

      {project ? (
        <>
          <PageHeader
            leading={<BackLink href="/admin/projects" label="Projelere dön" />}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {project.name}
                <StatusBadge status={project.status} />
              </span>
            }
            description={
              <>
                {project.keyword}
                {locationText.shown ? ` · ${locationText.shown}` : ""}
                {locationText.long ? (
                  <button
                    type="button"
                    onClick={() => setLocationOpen(true)}
                    className="ml-1 font-medium text-forest hover:underline"
                  >
                    …
                  </button>
                ) : null}
                <span className="mt-1 block text-xs">
                  {`Eklendi ${formatDate(project.created_at)}`}
                  {data?.firstScan
                    ? ` · İlk tarama ${formatDate(data.firstScan)}`
                    : ""}
                </span>
              </>
            }
            actions={
              <>
                {canPause ? (
                  <Button
                    variant="danger"
                    onClick={onToggleProjectStatus}
                    disabled={statusBusy}
                    title="Bu projedeki işler bırakılır; worker'lar başka aktif projelere geçer"
                  >
                    <Icon name="pause" className="h-4 w-4" />
                    {statusBusy ? "Durduruluyor…" : "Durdur"}
                  </Button>
                ) : null}
                {canResume ? (
                  <Button
                    variant="primary"
                    onClick={onToggleProjectStatus}
                    disabled={statusBusy}
                    title="Proje tekrar kuyruğa açılır"
                  >
                    <Icon name="play" className="h-4 w-4" />
                    {statusBusy ? "Başlatılıyor…" : "Devam Et"}
                  </Button>
                ) : null}
                <Button onClick={reload}>
                  <Icon name="refresh" className="h-4 w-4" />
                  Yenile
                </Button>
                <Button variant="primary" onClick={() => setExportOpen(true)}>
                  <Icon name="download" className="h-4 w-4" />
                  CSV dışa aktar
                </Button>
              </>
            }
          />

          {project.status === "paused" ? (
            <Card className="mb-4 border-mint/40 bg-pale p-3 text-sm text-forest">
              Proje duraklatıldı. Bu projeye ait liste/detay işleri worker’lara verilmez;
              worker’lar varsa diğer aktif projelerden iş almaya devam eder.
            </Card>
          ) : null}

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <Card className="p-4">
              <PhaseProgress
                label="Liste tarama"
                completed={list.completed}
                failed={list.failed}
                total={list.total}
                className="min-w-0"
              />
            </Card>
            <Card className="p-4">
              <PhaseProgress
                label="Detay tarama"
                completed={detail.completed}
                failed={detail.failed}
                total={detail.total}
                emptyLabel="Liste tamamlanınca başlar"
                className="min-w-0"
              />
            </Card>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Liste görev" value={list.total} />
            <StatCard label="Liste bekleyen" value={counts.pending ?? 0} tone="amber" />
            <StatCard
              label="Detay bekleyen"
              value={(detail.pending || 0) + (detail.active || 0)}
              tone="amber"
            />
            <StatCard label="Detay hata" value={detail.failed} tone={detail.failed ? "red" : undefined} />
            <StatCard label="İşletme" value={detail.total} tone="green" />
          </div>

          <div className="mb-3">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
          </div>

          {tab === "tasks" ? <TasksTab jobIds={jobIds} /> : null}
          {tab === "businesses" ? <BusinessesTab jobIds={jobIds} /> : null}
          {tab === "errors" ? <ErrorsTab jobIds={jobIds} /> : null}

          <Modal
            open={locationOpen}
            onClose={() => setLocationOpen(false)}
            title="Lokasyon"
          >
            <p className="mb-3 text-sm text-muted">
              {locationPlaces.length} il
            </p>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {locationPlaces.map((name) => (
                <li
                  key={name}
                  className="rounded-md bg-pale px-2 py-1.5 text-sm text-ink"
                >
                  {name}
                </li>
              ))}
            </ul>
          </Modal>

          <ExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            project={project}
            jobIds={jobIds}
          />
        </>
      ) : null}
    </>
  );
}

function TasksTab({ jobIds }) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debounced = useDebounced(search);
  const key = jobIds.join(",");

  const { data, error, loading, reload } = useAsyncData(
    () =>
      getProjectTasks(createClient(), jobIds, {
        status,
        search: debounced,
        page,
      }),
    [key, status, debounced, page],
    { interval: 10000 },
  );

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={TASK_FILTERS}
          active={status}
          onChange={(k) => {
            setStatus(k);
            setPage(0);
          }}
        />
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
          placeholder="Arama terimi ara..."
          className="sm:w-64"
        />
      </div>
      <div className="p-0">
        <ErrorBox message={error} onRetry={reload} />
        {loading && !data ? <LoadingBlock /> : null}
        {data && data.rows.length === 0 ? <EmptyState /> : null}
        {data && data.rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Arama terimi</Th>
                <Th>Durum</Th>
                <Th>Tür</Th>
                <Th>Sonuç</Th>
                <Th>Deneme</Th>
                <Th>İşçi</Th>
                <Th>Tamamlanma</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((t) => (
                <tr key={t.id}>
                  <Td className="max-w-xs">
                    <span className="break-words">{t.search_term || "-"}</span>
                    {t.last_error ? (
                      <p className="break-words text-xs text-red-600">
                        {t.last_error}
                      </p>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td>{TASK_TYPE_LABELS[t.task_type] || t.task_type}</Td>
                  <Td className="tabular-nums">{formatNumber(t.result_count)}</Td>
                  <Td className="tabular-nums">{t.attempt_count}</Td>
                  <Td>{t.workers?.name || "-"}</Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(t.completed_at)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : null}
        {data ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={data.count}
            onChange={setPage}
          />
        ) : null}
      </div>
    </Card>
  );
}

const DETAIL_FILTERS = [
  { value: "all", label: "Detay: tümü" },
  { value: "completed", label: "Detaylı" },
  { value: "pending", label: "Detay bekliyor" },
  { value: "claimed", label: "Detay alındı" },
  { value: "failed", label: "Detay hatalı" },
];

const PRESENCE_FILTERS = {
  phone: [
    { value: "all", label: "Telefon: tümü" },
    { value: "yes", label: "Telefonu olan" },
    { value: "no", label: "Telefonu olmayan" },
  ],
  website: [
    { value: "all", label: "Web sitesi: tümü" },
    { value: "yes", label: "Web sitesi olan" },
    { value: "no", label: "Web sitesi olmayan" },
  ],
};

function FilterSelect({ value, onChange, options, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cx(inputClass, "w-auto min-w-36")}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function BusinessesTab({ jobIds }) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [phone, setPhone] = useState("all");
  const [website, setWebsite] = useState("all");
  const [detail, setDetail] = useState("all");
  const [page, setPage] = useState(0);
  const debounced = useDebounced(search);
  const key = jobIds.join(",");
  const filtered =
    Boolean(from || to || debounced) ||
    phone !== "all" ||
    website !== "all" ||
    detail !== "all";

  const { data, error, loading, reload } = useAsyncData(
    () =>
      getProjectBusinesses(createClient(), jobIds, {
        search: debounced,
        page,
        from,
        to,
        phone,
        website,
        detail,
      }),
    [key, debounced, page, from, to, phone, website, detail],
  );

  function resetPage(setter) {
    return (value) => {
      setter(value);
      setPage(0);
    };
  }

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setPhone("all");
    setWebsite("all");
    setDetail("all");
    setPage(0);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="İşletme adı, place_id veya ilçe ara..."
          className="w-full sm:w-72"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Başlangıç
          <input
            type="date"
            aria-label="Başlangıç tarihi"
            value={from}
            onChange={(event) => resetPage(setFrom)(event.target.value)}
            className={cx(inputClass, "w-auto")}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Bitiş
          <input
            type="date"
            aria-label="Bitiş tarihi"
            value={to}
            onChange={(event) => resetPage(setTo)(event.target.value)}
            className={cx(inputClass, "w-auto")}
          />
        </label>
        <FilterSelect
          label="Telefon"
          value={phone}
          onChange={resetPage(setPhone)}
          options={PRESENCE_FILTERS.phone}
        />
        <FilterSelect
          label="Web sitesi"
          value={website}
          onChange={resetPage(setWebsite)}
          options={PRESENCE_FILTERS.website}
        />
        <FilterSelect
          label="Detay"
          value={detail}
          onChange={resetPage(setDetail)}
          options={DETAIL_FILTERS}
        />
        {filtered ? (
          <Button variant="ghost" onClick={clearFilters}>
            Temizle
          </Button>
        ) : null}
      </div>
      <ErrorBox message={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && data.rows.length === 0 ? (
        <EmptyState
          title="İşletme bulunamadı"
          description={
            filtered
              ? "Seçili filtrelere uyan işletme yok."
              : "Liste görevleri tamamlandıkça işletmeler burada görünür."
          }
        />
      ) : null}
      {data && data.rows.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>İşletme</Th>
              <Th>Konum</Th>
              <Th>Telefon</Th>
              <Th>Puan</Th>
              <Th>Detay</Th>
              <Th>Eklendi</Th>
              <Th>Terim</Th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((b) => (
              <tr key={b.id} className="hover:bg-pale">
                <Td>
                  <Link
                    href={`/admin/businesses/${b.id}`}
                    className="font-medium text-ink hover:text-forest"
                  >
                    {b.name || "(isimsiz)"}
                  </Link>
                  <p className="max-w-xs truncate font-mono text-xs text-muted">
                    {b.place_id}
                  </p>
                </Td>
                <Td>{[b.district, b.city].filter(Boolean).join(", ") || "-"}</Td>
                <Td className="whitespace-nowrap">{b.phone || "-"}</Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {b.rating ?? "-"}
                  {b.review_count ? (
                    <span className="text-xs text-muted"> ({b.review_count})</span>
                  ) : null}
                </Td>
                <Td>
                  <StatusBadge
                    status={b.detail_status}
                    label={
                      b.detail_status === "completed"
                        ? "Detaylı"
                        : b.detail_status === "pending"
                          ? "Bekliyor"
                          : undefined
                    }
                  />
                </Td>
                <Td className="whitespace-nowrap">{formatDate(b.created_at)}</Td>
                <Td>
                  <Badge>{new Set(b.scan_results.map((r) => r.search_term)).size}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : null}
      {data ? (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          count={data.count}
          onChange={setPage}
        />
      ) : null}
    </Card>
  );
}

function ErrorsTab({ jobIds }) {
  const key = jobIds.join(",");
  const { data, error, loading, reload } = useAsyncData(
    () => getProjectErrors(createClient(), jobIds),
    [key],
  );

  return (
    <Card>
      <CardHeader title="Son hatalar" subtitle="En fazla 50 kayıt" />
      <ErrorBox message={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && data.length === 0 ? <EmptyState title="Hata kaydı yok" /> : null}
      {data && data.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>Zaman</Th>
              <Th>Tür</Th>
              <Th>Mesaj</Th>
              <Th>Arama terimi</Th>
              <Th>İşçi</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{formatDate(e.created_at)}</Td>
                <Td>
                  <Badge tone="red">{e.error_type || "hata"}</Badge>
                </Td>
                <Td className="max-w-md break-words">{e.message || "-"}</Td>
                <Td>{e.scan_tasks?.search_term || "-"}</Td>
                <Td>{e.workers?.name || "-"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : null}
    </Card>
  );
}
