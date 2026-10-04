"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadDashboard } from "@/lib/admin/dashboard";
import { useAsyncData } from "@/lib/admin/hooks";
import { formatDate, timeAgo } from "@/lib/admin/format";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  PhaseProgress,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { Icon } from "@/components/icons";

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsyncData(
    () => loadDashboard(createClient()),
    [],
    { interval: 15000 },
  );

  const stats = data?.stats;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Kuyruk, işçi ve işletme özeti"
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

      <ErrorBox message={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Aktif proje" value={stats.active_projects} />
            <StatCard
              label="Bekleyen liste görevi"
              value={stats.pending_list_tasks}
              tone="amber"
            />
            <StatCard
              label="Detay bekleyen"
              value={stats.pending_detail_businesses}
              tone="amber"
            />
            <StatCard
              label="Toplam işletme"
              value={stats.total_businesses}
              tone="green"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Çevrimiçi işçi" value={stats.online_workers} tone="green" />
            <StatCard label="Çalışıyor" value={stats.working_workers} />
            <StatCard label="Boşta" value={stats.idle_workers} />
            <StatCard label="Duraklatıldı" value={stats.paused_workers} />
            <StatCard label="Çevrimdışı" value={stats.offline_workers} />
          </div>
        </>
      ) : null}

      {data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Son projeler"
              action={
                <Link
                  href="/admin/projects"
                  className="text-xs font-medium text-green-700 hover:underline dark:text-green-400"
                >
                  Tümü
                </Link>
              }
            />
            {data.projects.length === 0 ? (
              <EmptyState
                title="Henüz proje yok"
                action={
                  <ButtonLink href="/admin/projects/new" variant="primary" size="sm">
                    Proje oluştur
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.projects.map((p) => {
                  const list = p.progress?.list || {
                    total: 0,
                    completed: 0,
                    failed: 0,
                    found: 0,
                  };
                  const detail = p.progress?.detail || {
                    total: 0,
                    completed: 0,
                    failed: 0,
                  };
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {p.name}
                          </span>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-3">
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
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {list.found || 0} işletme · {formatDate(p.created_at)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Son hatalar" subtitle="scrape_errors" />
            {data.errors.length === 0 ? (
              <EmptyState title="Hata kaydı yok" />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.errors.map((e) => (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-red-700 dark:text-red-400">
                        {e.error_type || "hata"}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {timeAgo(e.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-zinc-800 dark:text-zinc-200">
                      {e.message || "-"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {e.workers?.name ? `İşçi: ${e.workers.name}` : null}
                      {e.scan_tasks?.search_term
                        ? ` · ${e.scan_tasks.search_term}`
                        : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
