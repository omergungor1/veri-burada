"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData, useDebounced } from "@/lib/admin/hooks";
import { DETAIL_STATUS_FILTERS, listBusinesses } from "@/lib/admin/businesses";
import { PAGE_SIZE, formatNumber } from "@/lib/admin/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  Tabs,
  Td,
  TableWrap,
  Th,
} from "@/components/ui";
import { Icon } from "@/components/icons";

function detailLabel(status) {
  return status === "completed"
    ? "Detaylı"
    : status === "pending"
      ? "Bekliyor"
      : undefined;
}

export default function BusinessesPage() {
  const [search, setSearch] = useState("");
  const [detailStatus, setDetailStatus] = useState("all");
  const [page, setPage] = useState(0);
  const debounced = useDebounced(search);

  const { data, error, loading, reload } = useAsyncData(
    () =>
      listBusinesses(createClient(), {
        search: debounced,
        detailStatus,
        page,
      }),
    [debounced, detailStatus, page],
  );

  return (
    <>
      <PageHeader
        title="İşletmeler"
        description={
          data ? `${formatNumber(data.count)} kayıt` : "Toplanan tüm işletmeler"
        }
        actions={
          <Button onClick={reload}>
            <Icon name="refresh" className="h-4 w-4" />
            Yenile
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 lg:flex-row lg:items-center lg:justify-between dark:border-zinc-800">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="İsim, place_id, il/ilçe, telefon veya adres ara..."
            className="lg:w-96"
          />
          <Tabs
            tabs={DETAIL_STATUS_FILTERS}
            active={detailStatus}
            onChange={(k) => {
              setDetailStatus(k);
              setPage(0);
            }}
          />
        </div>

        <ErrorBox message={error} onRetry={reload} />
        {loading && !data ? <LoadingBlock /> : null}
        {data && data.rows.length === 0 ? (
          <EmptyState
            title="İşletme bulunamadı"
            description="Arama veya filtreyi değiştirmeyi deneyin."
          />
        ) : null}

        {data && data.rows.length > 0 ? (
          <>
            {/* Mobil kartlar */}
            <ul className="divide-y divide-zinc-100 md:hidden dark:divide-zinc-800">
              {data.rows.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/businesses/${b.id}`}
                    className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium text-zinc-900 dark:text-zinc-100">
                        {b.name || "(isimsiz)"}
                      </span>
                      <StatusBadge
                        status={b.detail_status}
                        label={detailLabel(b.detail_status)}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {[b.district, b.city].filter(Boolean).join(", ") || "-"}
                      {b.phone ? ` · ${b.phone}` : ""}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-400">
                      {b.place_id}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Masaüstü tablo */}
            <div className="hidden md:block">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>İşletme</Th>
                    <Th>Tür</Th>
                    <Th>Konum</Th>
                    <Th>Telefon</Th>
                    <Th>Puan</Th>
                    <Th>Detay</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
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
                      </Td>
                      <Td>{b.business_type || "-"}</Td>
                      <Td>
                        {[b.district, b.city].filter(Boolean).join(", ") || "-"}
                      </Td>
                      <Td className="whitespace-nowrap">{b.phone || "-"}</Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {b.rating ?? "-"}
                        {b.review_count ? (
                          <span className="text-xs text-zinc-500">
                            {" "}
                            ({formatNumber(b.review_count)})
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <StatusBadge
                          status={b.detail_status}
                          label={detailLabel(b.detail_status)}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          </>
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
