"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData, useDebounced } from "@/lib/admin/hooks";
import { errorMessage } from "@/lib/admin/format";
import {
  adminLoadPackages,
  adminSearchCustomers,
  adminUpdatePackageUrl,
} from "@/lib/panel/api";
import { formatDate, formatNumber, formatTry } from "@/lib/panel/format";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorBox,
  Field,
  LoadingBlock,
  PageHeader,
  SearchInput,
  TableWrap,
  Td,
  Th,
  inputClass,
} from "@/components/ui";

export default function AdminCustomersPage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const [pkgUrls, setPkgUrls] = useState({});
  const [pkgMsg, setPkgMsg] = useState("");

  const { data, error, loading, reload } = useAsyncData(
    () => adminSearchCustomers(supabase, debounced),
    [debounced],
  );
  const { data: packages } = useAsyncData(() => adminLoadPackages(supabase), []);

  const rows = data || [];

  async function saveUrl(pkg) {
    setPkgMsg("");
    try {
      await adminUpdatePackageUrl(
        supabase,
        pkg.id,
        pkgUrls[pkg.id] ?? pkg.shopier_url ?? "",
      );
      setPkgMsg(`${pkg.name} bağlantısı kaydedildi.`);
    } catch (err) {
      setPkgMsg(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Müşteriler"
        description="Müşteri arayın, bakiyeyi görün ve kredi yüklemek için detaya gidin."
      />
      <ErrorBox message={error} onRetry={reload} />

      <Card className="mb-4">
        <CardHeader
          title="Shopier paket bağlantıları"
          subtitle="Satın Al butonu bu URL'lere gider. Boş bırakılırsa müşteri satın alamaz."
        />
        <div className="space-y-3 p-4">
          {pkgMsg ? <p className="text-sm text-muted">{pkgMsg}</p> : null}
          {(packages || []).map((pkg) => (
            <div key={pkg.id} className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
              <p className="text-sm font-medium text-ink">
                {pkg.name} · {formatNumber(pkg.credits)} / {formatTry(pkg.price_try)}
              </p>
              <Field label="Shopier URL">
                <input
                  value={pkgUrls[pkg.id] ?? pkg.shopier_url ?? ""}
                  onChange={(e) =>
                    setPkgUrls((prev) => ({ ...prev, [pkg.id]: e.target.value }))
                  }
                  placeholder="https://www.shopier.com/..."
                  className={inputClass}
                />
              </Field>
              <Button size="sm" onClick={() => saveUrl(pkg)}>
                Kaydet
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Ad, e-posta veya telefon"
        className="mb-3 max-w-md"
      />

      <Card>
        {loading && !data ? <LoadingBlock /> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState title="Müşteri bulunamadı." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Ad Soyad</Th>
                <Th>E-posta</Th>
                <Th>Telefon</Th>
                <Th>Kredi</Th>
                <Th>Yüklenen</Th>
                <Th>Harcanan</Th>
                <Th>Kayıt</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.full_name || "—"}</Td>
                  <Td>{row.email || "—"}</Td>
                  <Td>{row.phone || "—"}</Td>
                  <Td>{formatNumber(row.balance)}</Td>
                  <Td>{formatNumber(row.total_loaded)}</Td>
                  <Td>{formatNumber(row.total_spent)}</Td>
                  <Td>{formatDate(row.created_at)}</Td>
                  <Td>
                    <ButtonLink href={`/admin/customers/${row.id}`} size="sm">
                      Detay
                    </ButtonLink>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
