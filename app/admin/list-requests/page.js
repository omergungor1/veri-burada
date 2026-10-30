"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { errorMessage } from "@/lib/admin/format";
import {
  adminCompleteList,
  adminFailList,
  adminLoadListRequests,
  adminSetProcessing,
} from "@/lib/panel/api";
import {
  formatDate,
  formatListRegion,
  formatNumber,
  joinList,
  listStatus,
  REQUEST_TYPE_LABELS,
} from "@/lib/panel/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

export default function AdminListRequestsPage() {
  const supabase = createClient();
  const { data, error, loading, reload } = useAsyncData(
    () => adminLoadListRequests(supabase),
    [],
  );
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");

  async function run(id, fn, success) {
    setBusyId(id);
    setMsg("");
    try {
      await fn();
      setMsg(success);
      reload();
    } catch (err) {
      setMsg(errorMessage(err));
    }
    setBusyId("");
  }

  const rows = data || [];

  return (
    <>
      <PageHeader
        title="Müşteri liste talepleri"
        description="Talepler kuyruğa alınır. Hazırlamak için envanterdeki eşleşen işletmeleri bağlayın. Otomatik sahte tamamlanma yoktur."
      />
      <ErrorBox message={error} onRetry={reload} />
      {msg ? (
        <p className="mb-3 rounded-lg border border-border bg-white px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}

      <Card>
        {loading && !data ? <LoadingBlock /> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState title="Henüz müşteri liste talebi yok." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Müşteri</Th>
                <Th>Liste</Th>
                <Th>Durum</Th>
                <Th>İşletme</Th>
                <Th>Tarih</Th>
                <Th>İşlem</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const st = listStatus(row.status);
                const profile = row.profiles || {};
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <Td>
                      <p className="font-medium">{profile.full_name || "—"}</p>
                      <p className="text-xs text-muted">{profile.email}</p>
                    </Td>
                    <Td>
                      <p className="font-medium">{row.title}</p>
                      <p className="max-w-[240px] truncate text-xs text-muted">
                        {REQUEST_TYPE_LABELS[row.request_type] || "Liste"} ·{" "}
                        {joinList(row.keywords)} · {formatListRegion(row)}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </Td>
                    <Td>
                      {row.status === "ready" ? formatNumber(row.business_count) : "—"}
                    </Td>
                    <Td>{formatDate(row.created_at)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {row.status !== "ready" ? (
                          <>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  row.id,
                                  () => adminSetProcessing(supabase, row.id),
                                  "Hazırlanıyor olarak işaretlendi.",
                                )
                              }
                            >
                              İşleme al
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  row.id,
                                  () => adminCompleteList(supabase, row.id),
                                  "Envanterden dolduruldu ve hazırlandı.",
                                )
                              }
                            >
                              Envanterden doldur
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  row.id,
                                  () =>
                                    adminFailList(
                                      supabase,
                                      row.id,
                                      "Talep hazırlanamadı.",
                                    ),
                                  "Başarısız işaretlendi.",
                                )
                              }
                            >
                              Başarısız
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted">Hazır</span>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
