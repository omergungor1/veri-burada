"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { PAGE_SIZE } from "@/lib/admin/format";
import { loadLists } from "@/lib/panel/api";
import {
  formatDate,
  formatListRegion,
  formatNumber,
  joinList,
  listStatus,
} from "@/lib/panel/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  Pagination,
  Tabs,
} from "@/components/ui";
import { Icon } from "@/components/icons";

const TABS = [
  { key: "all", label: "Tümü" },
  { key: "preparing", label: "Hazırlanıyor" },
  { key: "ready", label: "Hazır" },
  { key: "failed", label: "Başarısız" },
];

function matchesTab(row, tab) {
  if (tab === "all") return true;
  if (tab === "preparing") return row.status === "queued" || row.status === "processing";
  return row.status === tab;
}

function regionLabel(row) {
  return formatListRegion(row);
}

export default function ListsPage() {
  const { data, error, loading, reload } = useAsyncData(
    () => loadLists(createClient()),
    [],
  );
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(0);
  const rows = data || [];

  const filtered = useMemo(
    () => rows.filter((row) => matchesTab(row, tab)),
    [rows, tab],
  );
  const counts = useMemo(
    () => ({
      all: rows.length,
      preparing: rows.filter((r) => r.status === "queued" || r.status === "processing").length,
      ready: rows.filter((r) => r.status === "ready").length,
      failed: rows.filter((r) => r.status === "failed").length,
    }),
    [rows],
  );
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Listelerim"
        description="İşletme listelerini buradan yönetebilir ve hazır olanları indirebilirsin."
        actions={
          <ButtonLink href="/panel/listeler/yeni" variant="primary">
            <Icon name="plus" className="h-4 w-4" />
            Yeni Liste
          </ButtonLink>
        }
      />
      <ErrorBox message={error} onRetry={reload} />

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(key) => {
          setTab(key);
          setPage(0);
        }}
        counts={counts}
      />

      <div className="mt-4">
        {loading && !data ? (
          <Card>
            <LoadingBlock />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              title="Bu filtrede liste yok."
              description="Yeni bir liste talebi oluşturarak başlayabilirsin."
              action={
                <ButtonLink href="/panel/listeler/yeni" variant="primary">
                  Yeni Liste
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map((row) => {
                const st = listStatus(row.status);
                const meta = [
                  regionLabel(row),
                  joinList(row.keywords),
                  formatDate(row.created_at),
                ]
                  .filter((part) => part && part !== "—")
                  .join(" · ");
                return (
                  <Link
                    key={row.id}
                    href={`/panel/listeler/${row.id}`}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-white px-3 py-3 shadow-sm hover:border-muted hover:bg-pale"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {meta}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="min-w-10 text-right text-sm tabular-nums whitespace-nowrap text-ink">
                        {row.status === "ready"
                          ? formatNumber(row.business_count)
                          : "—"}
                      </span>
                      <Icon
                        name="chevronRight"
                        className="h-4 w-4 text-muted"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
            {filtered.length > PAGE_SIZE ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={filtered.length}
                onChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
