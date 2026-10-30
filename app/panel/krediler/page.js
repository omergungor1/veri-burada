"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { errorMessage } from "@/lib/admin/format";
import {
  createCreditRequest,
  loadAccount,
  loadCreditRequests,
  loadPackages,
  loadTransactions,
  loadWallet,
} from "@/lib/panel/api";
import {
  creditRequestStatus,
  formatDate,
  formatNumber,
  formatTrMobile,
  formatTry,
  isValidTrMobile,
  perCreditCost,
  TX_TYPE_LABELS,
} from "@/lib/panel/format";
import {
  Badge,
  Button,
  Card,
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
  cx,
  inputClass,
} from "@/components/ui";

function emailOk(value) {
  const v = String(value || "").trim();
  return v.length > 4 && v.includes("@") && v.includes(".");
}

function RequestList({ requests }) {
  if (!requests.length) {
    return <p className="text-sm text-muted">Henüz kredi talebin yok.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {requests.map((row) => {
        const st = creditRequestStatus(row.status);
        return (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {row.package_name} · {formatNumber(row.credits)} kredi
              </p>
              <p className="text-xs text-muted">
                {formatDate(row.created_at)} · {formatTry(row.price_try)}
              </p>
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

export default function CreditsPage() {
  const supabase = createClient();
  const { data, error, loading, reload } = useAsyncData(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [wallet, packages, transactions, requests, account] = await Promise.all([
      loadWallet(supabase, user.id),
      loadPackages(supabase),
      loadTransactions(supabase),
      loadCreditRequests(supabase),
      loadAccount(supabase, user.id),
    ]);
    return {
      user,
      wallet,
      packages,
      transactions,
      requests,
      profile: account.profile,
    };
  }, []);

  const [buyPkg, setBuyPkg] = useState(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [sending, setSending] = useState(false);

  const balance = Number(data?.wallet?.balance || 0);
  const txs = data?.transactions || [];
  const requests = data?.requests || [];
  const loaded = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = txs.filter((t) => t.amount < 0).reduce((s, t) => s + -t.amount, 0);
  const canSend = emailOk(email) && isValidTrMobile(phone);

  function openBuy(pkg) {
    const profile = data?.profile || {};
    const authEmail = data?.user?.email || "";
    setBuyPkg(pkg);
    setEmail(profile.email || authEmail);
    setPhone(formatTrMobile(profile.phone || ""));
    setFormError("");
    setFormOk("");
  }

  async function submitRequest() {
    if (!buyPkg || !canSend) return;
    setSending(true);
    setFormError("");
    setFormOk("");
    try {
      await createCreditRequest(supabase, {
        packageId: buyPkg.id,
        email: email.trim(),
        phone,
      });
      setFormOk("Talebin alındı. Onay sonrası kredin bakiyene yüklenecek.");
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    }
    setSending(false);
  }

  return (
    <>
      <PageHeader
        title="İhtiyacın Kadar Kredi Al"
        description="Kredilerinle işletme listelerinin tamamına erişebilirsin. Kullanmadığın kredilerin hesabında kalır."
      />
      <ErrorBox message={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}

      {data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatCard label="Mevcut Krediniz" value={balance} />
            <StatCard label="Toplam Yüklenen Kredi" value={loaded} tone="green" />
            <StatCard label="Toplam Kullanılan Kredi" value={spent} />
            <StatCard label="Güncel Bakiye" value={balance} />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {(data.packages || []).map((pkg) => (
              <Card
                key={pkg.id}
                className={cx("p-3", pkg.is_popular && "ring-2 ring-green")}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{pkg.name}</p>
                  {pkg.is_popular ? <Badge tone="sky">Popüler</Badge> : null}
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                  {formatNumber(pkg.credits)}{" "}
                  <span className="text-xs font-medium text-muted">kredi</span>
                </p>
                <p className="text-sm font-medium text-ink">{formatTry(pkg.price_try)}</p>
                <p className="text-xs text-muted">
                  {perCreditCost(pkg.price_try, pkg.credits)}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => openBuy(pkg)}
                >
                  Satın al
                </Button>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Kredi taleplerin</h2>
            </div>
            <div className="px-4 py-2">
              <RequestList requests={requests} />
            </div>
          </Card>

          <Card className="mt-4">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Kredi hareketleri</h2>
            </div>
            {txs.length === 0 ? (
              <EmptyState title="Henüz kredi hareketi yok." />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Tarih</Th>
                    <Th>İşlem Türü</Th>
                    <Th>Açıklama</Th>
                    <Th>Kredi Değişimi</Th>
                    <Th>İşlem Sonrası Bakiye</Th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((row) => (
                    <tr key={row.id}>
                      <Td>{formatDate(row.created_at)}</Td>
                      <Td>{TX_TYPE_LABELS[row.transaction_type] || row.transaction_type}</Td>
                      <Td>{row.description || "—"}</Td>
                      <Td
                        className={
                          row.amount >= 0 ? "text-green" : "text-red-700"
                        }
                      >
                        {row.amount >= 0 ? "+" : ""}
                        {formatNumber(row.amount)}
                      </Td>
                      <Td>{formatNumber(row.balance_after)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </>
      ) : null}

      <Modal
        open={Boolean(buyPkg)}
        onClose={() => !sending && setBuyPkg(null)}
        title={buyPkg ? `${buyPkg.name} satın al` : "Satın al"}
        footer={
          <>
            <Button disabled={sending} onClick={() => setBuyPkg(null)}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              disabled={sending || !canSend}
              onClick={submitRequest}
            >
              {sending ? "Gönderiliyor…" : "Talep oluştur"}
            </Button>
          </>
        }
      >
        {buyPkg ? (
          <p className="mb-4 text-sm text-muted">
            {formatNumber(buyPkg.credits)} kredi · {formatTry(buyPkg.price_try)}
          </p>
        ) : null}
        <div className="space-y-3">
          <Field label="E-posta" htmlFor="credit-email">
            <input
              id="credit-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field
            label="Telefon"
            htmlFor="credit-phone"
            hint="05XX XXX XX XX"
          >
            <input
              id="credit-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="05XX XXX XX XX"
              value={phone}
              onChange={(e) => setPhone(formatTrMobile(e.target.value))}
              className={inputClass}
              required
            />
          </Field>
        </div>
        {formError ? (
          <p className="mt-3 text-sm text-red-700">{formError}</p>
        ) : null}
        {formOk ? (
          <p className="mt-3 text-sm text-forest">{formOk}</p>
        ) : null}
        <div className="mt-5 border-t border-border pt-3">
          <h4 className="mb-1 text-sm font-semibold text-ink">Önceki taleplerin</h4>
          <RequestList requests={requests} />
        </div>
      </Modal>
    </>
  );
}
