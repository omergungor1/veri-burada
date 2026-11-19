"use client";

import { use, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { PAGE_SIZE, formatNumber } from "@/lib/admin/format";
import { adminLoadList, adminLoadListBusinesses } from "@/lib/panel/api";
import {
  formatDate,
  formatListRegion,
  joinList,
  listStatus,
  REQUEST_TYPE_LABELS,
} from "@/lib/panel/format";
import {
  BackLink,
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  Pagination,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

export default function AdminListDetailPage({ params }) {
  const { id } = use(params);
  const [page, setPage] = useState(0);

  const { data: list, error, loading, reload } = useAsyncData(
    () => adminLoadList(createClient(), id),
    [id],
  );
  const {
    data: businesses,
    error: rowError,
    loading: rowsLoading,
    reload: reloadRows,
  } = useAsyncData(
    () => adminLoadListBusinesses(createClient(), id, page, PAGE_SIZE),
    [id, page],
  );

  const st = listStatus(list?.status);
  const profile = list?.profiles || {};
  const rows = businesses?.rows || [];
  const total = businesses?.count || 0;

  const missing = !loading && !list && !error;

  return (
    <>
      <PageHeader
        title={missing ? "Liste bulunamadı" : list?.title || "Liste"}
        description={
          list
            ? `${profile.full_name || profile.email || "Müşteri"} · ${
                REQUEST_TYPE_LABELS[list.request_type] || "Liste"
              } · ${joinList(list.keywords)} · ${formatListRegion(list)} · ${formatDate(list.created_at)}`
            : "Liste talebindeki işletmeler"
        }
        leading={<BackLink href="/admin/list-requests" label="Liste taleplerine dön" />}
      />
      <ErrorBox message={error || rowError} onRetry={() => { reload(); reloadRows(); }} />
      {loading && !list ? <LoadingBlock /> : null}
      {missing ? (
        <Card>
          <EmptyState title="Liste bulunamadı" />
        </Card>
      ) : null}

      {list ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            <span className="text-sm text-muted">
              {formatNumber(total)} işletme
            </span>
          </div>

          <Card>
            {rowsLoading && !businesses ? <LoadingBlock /> : null}
            {!rowsLoading && rows.length === 0 ? (
              <EmptyState
                title="Bu listede işletme yok"
                description="Liste hazırlanınca veya envanterden doldurulunca kayıtlar burada görünür."
              />
            ) : null}
            {rows.length > 0 ? (
              <>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>İşletme</Th>
                      <Th>Konum</Th>
                      <Th>Telefon</Th>
                      <Th>Web sitesi</Th>
                      <Th>Puan</Th>
                      <Th>Adres</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-pale">
                        <Td className="font-medium">
                          {row.business_id ? (
                            <Link
                              href={`/admin/businesses/${row.business_id}`}
                              className="text-ink hover:text-forest"
                            >
                              {row.business_name || "—"}
                            </Link>
                          ) : (
                            row.business_name || "—"
                          )}
                        </Td>
                        <Td>
                          {[row.district, row.city].filter(Boolean).join(", ") || "—"}
                        </Td>
                        <Td className="whitespace-nowrap">{row.phone || "—"}</Td>
                        <Td className="max-w-[180px] truncate">
                          {row.website ? (
                            <a
                              href={row.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-forest hover:underline"
                            >
                              {row.website}
                            </a>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td>
                          {row.rating != null ? formatNumber(row.rating) : "—"}
                        </Td>
                        <Td className="max-w-[240px] truncate" title={row.address || ""}>
                          {row.address || "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  count={total}
                  onChange={setPage}
                />
              </>
            ) : null}
          </Card>
        </>
      ) : null}
    </>
  );
}
