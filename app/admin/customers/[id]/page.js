"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { errorMessage } from "@/lib/admin/format";
import {
  adminGetCustomer,
  adminGrantCredits,
  adminLoadPackages,
} from "@/lib/panel/api";
import {
  formatDate,
  formatNumber,
  joinList,
  listStatus,
  TX_TYPE_LABELS,
} from "@/lib/panel/format";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorBox,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
  inputClass,
} from "@/components/ui";

export default function AdminCustomerDetailPage() {
  const { id } = useParams();
  const userId = String(id || "");
  const supabase = useMemo(() => createClient(), []);
  const [packageId, setPackageId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);

  const { data, error, loading, reload } = useAsyncData(
    () => adminGetCustomer(supabase, userId),
    [userId, tick],
  );
  const { data: packages } = useAsyncData(() => adminLoadPackages(supabase), []);

  const pkg = (packages || []).find((p) => p.id === packageId);
  const profile = data?.profile;

  async function grant() {
    if (!pkg) return;
    setWorking(true);
    setMsg("");
    try {
      await adminGrantCredits(supabase, {
        userId,
        packageId: pkg.id,
        paymentReference: reference.trim(),
        note: note.trim(),
      });
      setConfirm(false);
      setReference("");
      setNote("");
      setMsg(`${formatNumber(pkg.credits)} kredi yüklendi.`);
      setTick((n) => n + 1);
    } catch (err) {
      setMsg(errorMessage(err));
    }
    setWorking(false);
  }

  return (
    <>
      <PageHeader
        title={profile?.full_name || "Müşteri"}
        description={profile?.email}
        actions={<ButtonLink href="/admin/customers">Müşterilere dön</ButtonLink>}
      />
      <ErrorBox message={error} onRetry={reload} />
      {msg ? (
        <p className="mb-4 rounded-lg border border-border bg-white px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}
      {loading && !data ? <LoadingBlock /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Mevcut Kredi" value={data.balance} />
            <StatCard label="Toplam Yüklenen" value={data.total_loaded} tone="green" />
            <StatCard label="Toplam Harcanan" value={data.total_spent} />
            <StatCard label="Telefon" value={profile?.phone || "—"} />
          </div>

          <Card className="mt-4">
            <CardHeader title="Kredi yükle" />
            <div className="space-y-3 p-4">
              <Field label="Paket Seç">
                <select
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Paket seçin</option>
                  {(packages || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatNumber(p.credits)} kredi
                    </option>
                  ))}
                </select>
              </Field>
              {pkg ? (
                <p className="text-sm text-muted">
                  Yüklenecek: {formatNumber(pkg.credits)} Kredi
                </p>
              ) : null}
              <Field label="Shopier sipariş numarası / açıklama">
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={inputClass}
                  placeholder="Sipariş referansı (mükerrer yüklemeyi engeller)"
                />
              </Field>
              <Field label="Not">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Button
                variant="primary"
                disabled={!pkg}
                onClick={() => setConfirm(true)}
              >
                Kredi Yükle
              </Button>
            </div>
          </Card>

          <Card className="mt-4">
            <CardHeader title="Liste talepleri" />
            {(data.lists || []).length === 0 ? (
              <EmptyState title="Liste talebi yok." />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Liste</Th>
                    <Th>Durum</Th>
                    <Th>İşletme</Th>
                    <Th>Tarih</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.lists.map((row) => {
                    const st = listStatus(row.status);
                    return (
                      <tr key={row.id}>
                        <Td>
                          <p className="font-medium">{row.title}</p>
                          <p className="text-xs text-muted">
                            {joinList(row.keywords)} · {joinList(row.cities)}
                          </p>
                        </Td>
                        <Td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Td>
                        <Td>
                          {row.status === "ready"
                            ? formatNumber(row.business_count)
                            : "—"}
                        </Td>
                        <Td>{formatDate(row.created_at)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card className="mt-4">
            <CardHeader title="Kredi hareketleri" />
            {(data.transactions || []).length === 0 ? (
              <EmptyState title="Hareket yok." />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Tarih</Th>
                    <Th>Tür</Th>
                    <Th>Açıklama</Th>
                    <Th>Değişim</Th>
                    <Th>Referans</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((row) => (
                    <tr key={row.id}>
                      <Td>{formatDate(row.created_at)}</Td>
                      <Td>{TX_TYPE_LABELS[row.transaction_type] || row.transaction_type}</Td>
                      <Td>{row.description || "—"}</Td>
                      <Td>{formatNumber(row.amount)}</Td>
                      <Td>{row.payment_reference || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </>
      ) : null}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Kredi yüklemeyi onayla"
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Vazgeç</Button>
            <Button variant="primary" disabled={working} onClick={grant}>
              {working ? "Yükleniyor..." : "Onayla"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {profile?.full_name || "Bu kullanıcı"} adlı kullanıcıya{" "}
          {formatNumber(pkg?.credits || 0)} kredi yüklemek istediğinize emin
          misiniz?
        </p>
      </Modal>
    </>
  );
}
