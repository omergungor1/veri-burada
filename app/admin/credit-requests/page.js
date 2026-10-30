"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { errorMessage } from "@/lib/admin/format";
import {
  adminLoadCreditRequests,
  adminSetCreditRequestStatus,
} from "@/lib/panel/api";
import {
  creditRequestStatus,
  formatDate,
  formatNumber,
  formatTrMobile,
  formatTry,
} from "@/lib/panel/format";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  TableWrap,
  Tabs,
  Td,
  Th,
} from "@/components/ui";

const TABS = [
  { key: "pending", label: "Bekliyor" },
  { key: "approved", label: "Onaylandı" },
  { key: "cancelled", label: "İptal" },
  { key: "all", label: "Tümü" },
];

export default function AdminCreditRequestsPage() {
  const supabase = createClient();
  const { data, error, loading, reload } = useAsyncData(
    () => adminLoadCreditRequests(supabase),
    [],
  );
  const [tab, setTab] = useState("pending");
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");

  async function setStatus(id, status) {
    setBusyId(id);
    setMsg("");
    try {
      await adminSetCreditRequestStatus(supabase, id, status);
      setMsg(
        status === "approved"
          ? "Talep onaylandı. Krediyi müşteri sayfasından manuel yükle."
          : "Talep iptal edildi.",
      );
      reload();
    } catch (err) {
      setMsg(errorMessage(err));
    }
    setBusyId("");
  }

  const rows = (data || []).filter((row) => tab === "all" || row.status === tab);
  const counts = {
    pending: (data || []).filter((r) => r.status === "pending").length,
    approved: (data || []).filter((r) => r.status === "approved").length,
    cancelled: (data || []).filter((r) => r.status === "cancelled").length,
    all: (data || []).length,
  };

  return (
    <>
      <PageHeader
        title="Kredi talepleri"
        description="Müşteri satın alma taleplerini onayla veya iptal et. Bakiye yüklemesi müşteri detayından manuel yapılır."
      />
      <ErrorBox message={error} onRetry={reload} />
      {msg ? (
        <p className="mb-3 rounded-lg border border-border bg-white px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}

      <div className="mb-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} counts={counts} />
      </div>

      <Card>
        {loading && !data ? <LoadingBlock /> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState title="Bu durumda kredi talebi yok." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Müşteri</Th>
                <Th>Paket</Th>
                <Th>İletişim</Th>
                <Th>Durum</Th>
                <Th>Tarih</Th>
                <Th>İşlem</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const st = creditRequestStatus(row.status);
                const profile = row.profiles || {};
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <Td>
                      <p className="font-medium">{profile.full_name || "—"}</p>
                      <p className="text-xs text-muted">{profile.email}</p>
                    </Td>
                    <Td>
                      <p className="font-medium">{row.package_name}</p>
                      <p className="text-xs text-muted">
                        {formatNumber(row.credits)} kredi · {formatTry(row.price_try)}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-sm">{row.contact_email}</p>
                      <p className="text-xs text-muted">
                        {formatTrMobile(row.contact_phone)}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </Td>
                    <Td>{formatDate(row.created_at)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {row.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              onClick={() => setStatus(row.id, "approved")}
                            >
                              Onayla
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() => setStatus(row.id, "cancelled")}
                            >
                              İptal
                            </Button>
                          </>
                        ) : null}
                        <ButtonLink
                          href={`/admin/customers/${row.user_id}`}
                          size="sm"
                        >
                          Müşteri
                        </ButtonLink>
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
