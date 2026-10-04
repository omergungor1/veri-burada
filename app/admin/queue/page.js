"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import {
  DETAIL_TABS,
  LIST_TABS,
  getQueueCounts,
  listQueue,
  retryQueueFailures,
} from "@/lib/admin/queue";
import {
  PAGE_SIZE,
  TASK_TYPE_LABELS,
  formatDate,
  formatNumber,
  timeAgo,
} from "@/lib/admin/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  Pagination,
  StatusBadge,
  Tabs,
  Td,
  TableWrap,
  Th,
} from "@/components/ui";
import { Icon } from "@/components/icons";

const POLL_MS = 10000;

const KINDS = [
  { key: "list", label: "Liste görevleri" },
  { key: "detail", label: "Detay kuyruğu" },
];

export default function QueuePage() {
  const [kind, setKind] = useState("list");
  const [tab, setTab] = useState("pending");
  const [page, setPage] = useState(0);
  const [retryBusy, setRetryBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const tabs = kind === "detail" ? DETAIL_TABS : LIST_TABS;

  const { data, error, loading, reload, updatedAt } = useAsyncData(
    async () => {
      const supabase = createClient();
      const [list, counts] = await Promise.all([
        listQueue(supabase, { kind, tab, page }),
        getQueueCounts(supabase, kind),
      ]);
      return { ...list, counts, kind };
    },
    [kind, tab, page],
    { interval: POLL_MS },
  );

  const failedCount = data?.counts?.failed || 0;

  function changeKind(k) {
    setKind(k);
    setTab("pending");
    setPage(0);
    setActionError("");
  }

  async function onRetryFailed() {
    if (!failedCount || retryBusy) return;
    setActionError("");
    setRetryBusy(true);
    try {
      const res = await retryQueueFailures(createClient(), kind);
      const n =
        kind === "detail"
          ? res?.detail_retried || 0
          : res?.list_retried || 0;
      if (!n) setActionError("Yeniden kuyruğa alınacak kayıt bulunamadı.");
      setTab("pending");
      setPage(0);
      await reload();
    } catch (e) {
      setActionError(e?.message || "Hatalılar yeniden kuyruğa alınamadı");
    } finally {
      setRetryBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Kuyruk"
        description={`Her ${POLL_MS / 1000} saniyede otomatik yenilenir${
          updatedAt
            ? ` · son güncelleme ${updatedAt.toLocaleTimeString("tr-TR")}`
            : ""
        }`}
        actions={
          <Button onClick={reload}>
            <Icon name="refresh" className="h-4 w-4" />
            Yenile
          </Button>
        }
      />

      <div className="mb-3 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => changeKind(k.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              kind === k.key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              tabs={tabs}
              active={tab}
              counts={data?.counts}
              onChange={(k) => {
                setTab(k);
                setPage(0);
                setActionError("");
              }}
            />
            {tab === "failed" ? (
              <Button
                variant="primary"
                size="sm"
                disabled={!failedCount || retryBusy}
                onClick={onRetryFailed}
                title="Başarısız kayıtları tekrar pending kuyruğuna alır"
              >
                <Icon name="refresh" className="h-4 w-4" />
                {retryBusy
                  ? "Kuyruğa alınıyor…"
                  : `Hatalıları tekrar tara${failedCount ? ` (${formatNumber(failedCount)})` : ""}`}
              </Button>
            ) : null}
          </div>
        </div>

        <ErrorBox message={error || actionError} onRetry={reload} />
        {loading && !data ? <LoadingBlock /> : null}
        {data && data.rows.length === 0 ? (
          <EmptyState title="Bu filtrede kayıt yok" />
        ) : null}

        {data && data.rows.length > 0 && data.kind === "list" ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Arama terimi</Th>
                <Th>Proje</Th>
                <Th>Durum</Th>
                <Th>İşçi</Th>
                <Th>Deneme</Th>
                <Th>Sonuç</Th>
                <Th>Lease bitişi</Th>
                <Th>Güncellenme</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((t) => {
                const project = t.scan_jobs?.projects;
                return (
                  <tr key={t.id}>
                    <Td className="max-w-xs">
                      <span className="break-words">{t.search_term || "-"}</span>
                      <p className="text-xs text-zinc-500">
                        {TASK_TYPE_LABELS[t.task_type] || t.task_type}
                      </p>
                      {t.last_error ? (
                        <p className="break-words text-xs text-red-600 dark:text-red-400">
                          {t.last_error}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      {project ? (
                        <Link
                          href={`/admin/projects/${project.id}`}
                          className="text-green-700 hover:underline dark:text-green-400"
                        >
                          {project.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td>{t.workers?.name || "-"}</Td>
                    <Td className="tabular-nums">{t.attempt_count}</Td>
                    <Td className="tabular-nums">{formatNumber(t.result_count)}</Td>
                    <Td className="whitespace-nowrap">
                      {t.lease_expires_at ? formatDate(t.lease_expires_at) : "-"}
                    </Td>
                    <Td className="whitespace-nowrap">{timeAgo(t.updated_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : null}

        {data && data.rows.length > 0 && data.kind === "detail" ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>İşletme</Th>
                <Th>Konum</Th>
                <Th>Durum</Th>
                <Th>İşçi</Th>
                <Th>Deneme</Th>
                <Th>Lease bitişi</Th>
                <Th>Güncellenme</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((b) => (
                <tr key={b.id}>
                  <Td className="max-w-xs">
                    <Link
                      href={`/admin/businesses/${b.id}`}
                      className="font-medium text-zinc-900 hover:text-green-700 dark:text-zinc-100 dark:hover:text-green-400"
                    >
                      {b.name || "(isimsiz)"}
                    </Link>
                    <p className="truncate font-mono text-xs text-zinc-500">
                      {b.place_id}
                    </p>
                    {b.detail_last_error ? (
                      <p className="break-words text-xs text-red-600 dark:text-red-400">
                        {b.detail_last_error}
                      </p>
                    ) : null}
                  </Td>
                  <Td>{[b.district, b.city].filter(Boolean).join(", ") || "-"}</Td>
                  <Td>
                    <StatusBadge
                      status={b.detail_status}
                      label={b.detail_status === "completed" ? "Detaylı" : undefined}
                    />
                  </Td>
                  <Td>{b.workers?.name || "-"}</Td>
                  <Td className="tabular-nums">{b.detail_attempt_count}</Td>
                  <Td className="whitespace-nowrap">
                    {b.detail_lease_expires_at
                      ? formatDate(b.detail_lease_expires_at)
                      : "-"}
                  </Td>
                  <Td className="whitespace-nowrap">{timeAgo(b.updated_at)}</Td>
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
    </>
  );
}
