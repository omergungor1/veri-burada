"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { listProjects, retryProjectFailures } from "@/lib/admin/projects";
import { formatDate, formatNumber, projectScanDuration } from "@/lib/admin/format";
import {
  ActionMenu,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  Modal,
  PageHeader,
  PhaseProgress,
  StatusBadge,
  Td,
  TableWrap,
  Th,
  cx,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import ExportModal from "@/components/export-modal";

function projectProgress(p) {
  return (
    p.progress || {
      list: { total: 0, completed: 0, failed: 0, done: 0, found: 0 },
      detail: { total: 0, completed: 0, failed: 0, done: 0 },
    }
  );
}

function failureCount(p) {
  const { list, detail } = projectProgress(p);
  return (list.failed || 0) + (detail.failed || 0);
}

const META_MAX = 36;

function projectMeta(project) {
  return [project?.keyword, project?.location].filter(Boolean).join(" · ");
}

function shortenMeta(text) {
  if (!text || text.length <= META_MAX) return { text: text || "", truncated: false };
  const slice = text.slice(0, META_MAX);
  const lastComma = slice.lastIndexOf(",");
  const cut = lastComma > 16 ? slice.slice(0, lastComma) : slice.replace(/[,\s]+$/, "");
  return { text: cut + "…", truncated: true };
}

const metaClass =
  "w-full whitespace-normal break-words text-left text-xs leading-snug text-muted";

function ProjectMetaLine({ project, onOpen }) {
  const full = projectMeta(project);
  const { text, truncated } = shortenMeta(full);
  if (!truncated) {
    return <p className={metaClass}>{full}</p>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen(project);
      }}
      title="Tümünü göster"
      className={cx(metaClass, "hover:text-forest hover:underline")}
    >
      {text}
    </button>
  );
}

export default function ProjectsPage() {
  const { data, error, loading, reload } = useAsyncData(
    () => listProjects(createClient()),
    [],
    { interval: 15000 },
  );
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [exportProject, setExportProject] = useState(null);
  const [metaProject, setMetaProject] = useState(null);

  async function onRetryFailures(project) {
    const n = failureCount(project);
    if (!n || busyId) return;
    setActionError("");
    setBusyId(project.id);
    try {
      const res = await retryProjectFailures(createClient(), project.id);
      if (!res?.list_retried && !res?.detail_retried) {
        setActionError("Yeniden kuyruğa alınacak hata bulunamadı.");
      }
      await reload();
    } catch (e) {
      setActionError(e?.message || "Hatalılar yeniden kuyruğa alınamadı");
    } finally {
      setBusyId(null);
    }
  }

  function menuItems(p) {
    const fails = failureCount(p);
    const jobIds = (p.scan_jobs || []).map((j) => j.id);
    return [
      {
        key: "export-csv",
        label: "CSV dışa aktar",
        icon: "download",
        disabled: !jobIds.length,
        onClick: () => setExportProject(p),
      },
      {
        key: "retry-failures",
        label:
          busyId === p.id
            ? "Kuyruğa alınıyor…"
            : fails
              ? `Hatalıları tekrar tara (${fails})`
              : "Hatalıları tekrar tara",
        icon: "refresh",
        disabled: !fails || busyId === p.id || p.status === "cancelled",
        onClick: () => onRetryFailures(p),
      },
    ];
  }

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Projeler"
        description="Tarama projeleri — liste ve detay ilerlemesi"
        actions={
          <>
            <Button onClick={reload}>
              <Icon name="refresh" className="h-4 w-4" />
              Yenile
            </Button>
            <ButtonLink href="/admin/projects/new" variant="primary">
              <Icon name="plus" className="h-4 w-4" />
              Yeni proje
            </ButtonLink>
          </>
        }
      />
      <ErrorBox message={error || actionError} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}

      {data && data.length === 0 ? (
        <Card>
          <EmptyState
            title="Henüz proje yok"
            description="Yeni bir proje oluşturarak arama görevlerini kuyruğa ekleyin."
            action={
              <ButtonLink href="/admin/projects/new" variant="primary" size="sm">
                Proje oluştur
              </ButtonLink>
            }
          />
        </Card>
      ) : null}

      {data && data.length > 0 ? (
        <>
          {/* Mobil: kartlar */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto md:hidden">
            {data.map((p) => {
              const { list, detail } = projectProgress(p);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/projects/${p.id}`} className="block">
                        <p className="truncate font-medium text-ink">
                          {p.name}
                        </p>
                      </Link>
                      <ProjectMetaLine project={p} onOpen={setMetaProject} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusBadge status={p.status} />
                      <ActionMenu items={menuItems(p)} />
                    </div>
                  </div>
                  <Link href={`/admin/projects/${p.id}`} className="mt-3 block">
                    <div className="grid grid-cols-2 gap-3">
                      <PhaseProgress
                        label="Liste"
                        completed={list.completed}
                        failed={list.failed}
                        total={list.total}
                      />
                      <PhaseProgress
                        label="Detay"
                        completed={detail.completed}
                        failed={detail.failed}
                        total={detail.total}
                        emptyLabel="Liste sonrası"
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {formatNumber(list.found)} işletme · {projectScanDuration(p)}
                    </p>
                  </Link>
                </Card>
              );
            })}
          </div>

          {/* Masaüstü: tablo */}
          <Card className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
            <TableWrap
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
              tableClassName="table-fixed"
            >
              <thead className="sticky top-0 z-10">
                <tr>
                  <Th className="w-[22%] sticky top-0">Proje</Th>
                  <Th className="w-[10%] sticky top-0">Durum</Th>
                  <Th className="w-[16%] sticky top-0">Liste tarama</Th>
                  <Th className="w-[16%] sticky top-0">Detay tarama</Th>
                  <Th className="w-[8%] sticky top-0">İşletme</Th>
                  <Th className="w-[10%] sticky top-0">Süre</Th>
                  <Th className="w-[12%] sticky top-0">Oluşturulma</Th>
                  <Th className="w-10 sticky top-0">
                    <span className="sr-only">İşlemler</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => {
                  const { list, detail } = projectProgress(p);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-pale"
                    >
                      <Td>
                        <Link
                          href={`/admin/projects/${p.id}`}
                          className="font-medium text-ink hover:text-forest"
                        >
                          {p.name}
                        </Link>
                        <ProjectMetaLine project={p} onOpen={setMetaProject} />
                      </Td>
                      <Td>
                        <StatusBadge status={p.status} />
                      </Td>
                      <Td>
                        <PhaseProgress
                          label="Liste"
                          completed={list.completed}
                          failed={list.failed}
                          total={list.total}
                          className="min-w-0"
                        />
                      </Td>
                      <Td>
                        <PhaseProgress
                          label="Detay"
                          completed={detail.completed}
                          failed={detail.failed}
                          total={detail.total}
                          className="min-w-0"
                          emptyLabel="Liste sonrası"
                        />
                      </Td>
                      <Td className="tabular-nums">{formatNumber(list.found)}</Td>
                      <Td className="whitespace-nowrap tabular-nums text-muted">
                        {projectScanDuration(p)}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </Td>
                      <Td className="text-right">
                        <ActionMenu items={menuItems(p)} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </Card>
        </>
      ) : null}
    </div>

      <ExportModal
        open={!!exportProject}
        onClose={() => setExportProject(null)}
        project={exportProject}
        jobIds={(exportProject?.scan_jobs || []).map((j) => j.id)}
      />

      <Modal
        open={!!metaProject}
        onClose={() => setMetaProject(null)}
        title={metaProject?.name || "Proje bilgisi"}
      >
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Anahtar kelime
            </dt>
            <dd className="text-ink">{metaProject?.keyword || "—"}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Lokasyon
            </dt>
            <dd className="thin-scroll max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-ink">
              {metaProject?.location || "—"}
            </dd>
          </div>
        </dl>
      </Modal>
    </>
  );
}
