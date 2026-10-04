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
  PageHeader,
  PhaseProgress,
  StatusBadge,
  Td,
  TableWrap,
  Th,
} from "@/components/ui";
import { Icon } from "@/components/icons";

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

export default function ProjectsPage() {
  const { data, error, loading, reload } = useAsyncData(
    () => listProjects(createClient()),
    [],
    { interval: 15000 },
  );
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);

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
    return [
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
          <div className="space-y-3 md:hidden">
            {data.map((p) => {
              const { list, detail } = projectProgress(p);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/projects/${p.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {p.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {p.keyword} · {p.location}
                      </p>
                    </Link>
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
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatNumber(list.found)} işletme · {projectScanDuration(p)}
                    </p>
                  </Link>
                </Card>
              );
            })}
          </div>

          {/* Masaüstü: tablo */}
          <Card className="hidden md:block">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Proje</Th>
                  <Th>Durum</Th>
                  <Th className="w-52">Liste tarama</Th>
                  <Th className="w-52">Detay tarama</Th>
                  <Th>İşletme</Th>
                  <Th>Süre</Th>
                  <Th>Oluşturulma</Th>
                  <Th className="w-12">
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
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <Td>
                        <Link
                          href={`/admin/projects/${p.id}`}
                          className="font-medium text-zinc-900 hover:text-green-700 dark:text-zinc-100 dark:hover:text-green-400"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-zinc-500">
                          {p.keyword} · {p.location}
                        </p>
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
                        />
                      </Td>
                      <Td>
                        <PhaseProgress
                          label="Detay"
                          completed={detail.completed}
                          failed={detail.failed}
                          total={detail.total}
                          emptyLabel="Liste sonrası"
                        />
                      </Td>
                      <Td className="tabular-nums">{formatNumber(list.found)}</Td>
                      <Td className="whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-300">
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
    </>
  );
}
