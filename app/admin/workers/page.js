"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import {
  effectiveStatus,
  getVisibleWorkerActions,
  listWorkers,
  setWorkerAction,
  summarizeWorkers,
} from "@/lib/admin/workers";
import {
  WORKER_ACTION_LABELS,
  errorMessage,
  formatNumber,
  timeAgo,
} from "@/lib/admin/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { Icon } from "@/components/icons";

const FILTERS = [
  { key: "online", label: "Çevrimiçi" },
  { key: "working", label: "Çalışıyor" },
  { key: "paused", label: "Duraklatıldı" },
  { key: "offline", label: "Çevrimdışı" },
  { key: "all", label: "Tümü" },
];

function matchesFilter(status, filter) {
  if (filter === "all") return true;
  if (filter === "online") return status !== "offline";
  return status === filter;
}

export default function WorkersPage() {
  const [filter, setFilter] = useState("online");
  const [busyKey, setBusyKey] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const { data, error, loading, reload, updatedAt } = useAsyncData(
    () => listWorkers(createClient()),
    [],
    { interval: 10000 },
  );

  const workers = data?.workers;
  const onlineSeconds = data?.onlineSeconds ?? 90;

  const summary = useMemo(
    () => (workers ? summarizeWorkers(workers, onlineSeconds) : null),
    [workers, onlineSeconds],
  );

  const visible = useMemo(() => {
    if (!workers) return [];
    return workers.filter((w) =>
      matchesFilter(effectiveStatus(w, onlineSeconds), filter),
    );
  }, [workers, onlineSeconds, filter]);

  async function runAction(worker, action, confirmNeeded) {
    const label = WORKER_ACTION_LABELS[action] || action;
    if (
      confirmNeeded &&
      !window.confirm(`"${worker.name || worker.worker_key}" için "${label}" uygulansın mı?`)
    ) {
      return;
    }
    setActionError("");
    setNotice("");
    setBusyKey(`${worker.id}:${action}`);
    try {
      await setWorkerAction(createClient(), worker.id, action);
      setNotice(`"${label}" komutu ${worker.name || "işçi"} için gönderildi.`);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <>
      <PageHeader
        title="İşçiler"
        description={`Extension işçileri · çevrimiçi eşiği ${onlineSeconds} sn${
          updatedAt ? ` · son güncelleme ${updatedAt.toLocaleTimeString("tr-TR")}` : ""
        }`}
        actions={
          <Button onClick={reload}>
            <Icon name="refresh" className="h-4 w-4" />
            Yenile
          </Button>
        }
      />

      <ErrorBox message={error} onRetry={reload} />
      <ErrorBox message={actionError} />
      {notice ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          {notice}
        </div>
      ) : null}

      {loading && !data ? <LoadingBlock /> : null}

      {summary ? (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Toplam" value={summary.total} />
          <StatCard label="Çevrimiçi" value={summary.online} tone="green" />
          <StatCard label="Çalışıyor" value={summary.working} tone="green" />
          <StatCard label="Boşta / duraklatıldı" value={`${summary.idle} / ${summary.paused}`} />
          <StatCard label="Çevrimdışı" value={summary.offline} />
        </div>
      ) : null}

      {workers ? (
        <>
          <div className="mb-3">
            <Tabs tabs={FILTERS} active={filter} onChange={setFilter} />
          </div>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                title="İşçi bulunamadı"
                description="Extension çalıştığında işçiler otomatik olarak buraya kaydolur."
              />
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {visible.map((w) => {
                const status = effectiveStatus(w, onlineSeconds);
                return (
                  <Card key={w.id} className="flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {w.name || "İsimsiz işçi"}
                        </p>
                        <p
                          className="truncate font-mono text-xs text-zinc-500"
                          title={w.worker_key}
                        >
                          {w.worker_key}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={status} />
                        <Badge tone={w.auto_mode ? "green" : "zinc"}>
                          Otomatik: {w.auto_mode ? "açık" : "kapalı"}
                        </Badge>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <Item label="Son sinyal">{timeAgo(w.last_heartbeat_at)}</Item>
                      <Item label="Sürüm">{w.extension_version || "-"}</Item>
                      <Item label="Liste görevi">
                        {formatNumber(w.processed_list_tasks)}
                      </Item>
                      <Item label="Detay işletme">
                        {formatNumber(w.processed_detail_businesses)}
                      </Item>
                      <Item label="Başarısız">{formatNumber(w.failed_tasks)}</Item>
                      <Item label="Mevcut görev">
                        {w.current_task_type
                          ? w.current_task_type === "detail"
                            ? "Detay"
                            : "Liste"
                          : "-"}
                      </Item>
                    </dl>

                    {w.current_search_term ? (
                      <p className="mt-2 break-words rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                        {w.current_search_term}
                      </p>
                    ) : null}
                    {w.requested_action ? (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                        Bekleyen komut:{" "}
                        <strong>
                          {WORKER_ACTION_LABELS[w.requested_action] ||
                            w.requested_action}
                        </strong>
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      {getVisibleWorkerActions(w, status).map((a) => (
                        <Button
                          key={a.key}
                          size="sm"
                          variant={
                            a.tone === "danger"
                              ? "danger"
                              : a.tone === "primary"
                                ? "primary"
                                : "secondary"
                          }
                          disabled={busyKey === `${w.id}:${a.key}`}
                          onClick={() => runAction(w, a.key, a.confirm)}
                          title={a.label}
                        >
                          <Icon name={a.icon} className="h-3.5 w-3.5" />
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

function Item({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="truncate font-medium text-zinc-800 dark:text-zinc-200">
        {children}
      </dd>
    </div>
  );
}
