"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData, useDebounced } from "@/lib/admin/hooks";
import { DETAIL_STATUS_FILTERS, listBusinesses } from "@/lib/admin/businesses";
import { PAGE_SIZE, formatNumber } from "@/lib/admin/format";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Tabs,
  Td,
  TableWrap,
  Th,
} from "@/components/ui";
import { Icon } from "@/components/icons";

function hoursText(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw.startsWith("{")) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Object.entries(parsed)
      .map(([day, hours]) => `${day}: ${hours}`)
      .join("\n");
  } catch {
    return raw;
  }
}

function Stars({ rating }) {
  const value = Number(rating);
  if (!Number.isFinite(value)) return null;
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="tracking-tight text-amber-500" aria-hidden="true">
      {"★★★★★".slice(0, full)}
      <span className="text-border">{"★★★★★".slice(full)}</span>
    </span>
  );
}

function PreviewRow({ icon, children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3 text-sm text-ink">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function BusinessPreview({ business, loading, error }) {
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBox message={error} />;
  if (!business) return <EmptyState title="İşletme bulunamadı" />;

  const address =
    business.full_address ||
    [business.district, business.city].filter(Boolean).join(", ");

  return (
    <div className="-mx-4 -mt-4">
      {business.image_url ? (
        <img
          src={business.image_url}
          alt=""
          className="h-44 w-full object-cover"
        />
      ) : null}
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            {business.rating != null ? (
              <>
                <span className="font-medium text-ink">{business.rating}</span>
                <Stars rating={business.rating} />
                {business.review_count ? (
                  <span>({formatNumber(business.review_count)})</span>
                ) : null}
              </>
            ) : null}
          </p>
          {business.business_type ? (
            <p className="mt-1 text-sm text-muted">{business.business_type}</p>
          ) : null}
        </div>
        <div className="space-y-3">
          <PreviewRow icon="pin">{address}</PreviewRow>
          <PreviewRow icon="clock">
            {hoursText(business.working_hours) ? (
              <span className="whitespace-pre-line">
                {hoursText(business.working_hours)}
              </span>
            ) : null}
          </PreviewRow>
          <PreviewRow icon="globe">
            {business.website ? (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-forest hover:underline"
              >
                {business.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </PreviewRow>
          <PreviewRow icon="phone">{business.phone}</PreviewRow>
          <PreviewRow icon="pin">{business.plus_code}</PreviewRow>
        </div>
      </div>
    </div>
  );
}

function ViewButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="İşletmeyi görüntüle"
      title="Görüntüle"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-pale hover:text-ink"
    >
      <Icon name="eye" className="h-4 w-4" />
    </button>
  );
}

export default function BusinessesPage() {
  const [search, setSearch] = useState("");
  const [detailStatus, setDetailStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState(null);
  const debounced = useDebounced(search);

  async function openPreview(id) {
    setPreview({ loading: true, error: "", business: null });
    try {
      const { data: business, error } = await createClient()
        .from("businesses")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      setPreview({ loading: false, error: "", business });
    } catch (e) {
      setPreview({
        loading: false,
        error: e?.message || "İşletme açılamadı",
        business: null,
      });
    }
  }

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
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
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
            <ul className="divide-y divide-border md:hidden">
              {data.rows.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/businesses/${b.id}`}
                      className="min-w-0 break-words font-medium text-ink hover:text-forest"
                    >
                      {b.name || "(isimsiz)"}
                    </Link>
                    <ViewButton onClick={() => openPreview(b.id)} />
                  </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {[b.district, b.city].filter(Boolean).join(", ") || "-"}
                      {b.phone ? ` · ${b.phone}` : ""}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      {b.place_id}
                    </p>
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
                    <Th className="w-14">
                      <span className="sr-only">İşlem</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-pale"
                    >
                      <Td className="max-w-xs">
                        <Link
                          href={`/admin/businesses/${b.id}`}
                          className="font-medium text-ink hover:text-forest"
                        >
                          {b.name || "(isimsiz)"}
                        </Link>
                        <p className="truncate font-mono text-xs text-muted">
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
                          <span className="text-xs text-muted">
                            {" "}
                            ({formatNumber(b.review_count)})
                          </span>
                        ) : null}
                      </Td>
                      <Td className="text-right">
                        <ViewButton onClick={() => openPreview(b.id)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          </>
        ) : null}

        <Modal
          open={!!preview}
          onClose={() => setPreview(null)}
          title={preview?.business?.name || "İşletme"}
          footer={
            preview?.business ? (
              <>
                <Button onClick={() => setPreview(null)}>Kapat</Button>
                {preview.business.google_maps_url ? (
                  <ButtonLink
                    href={preview.business.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="external" className="h-4 w-4" />
                    Haritalar
                  </ButtonLink>
                ) : null}
                <ButtonLink
                  href={`/admin/businesses/${preview.business.id}`}
                  variant="primary"
                >
                  Tam sayfa
                </ButtonLink>
              </>
            ) : null
          }
        >
          <BusinessPreview
            business={preview?.business}
            loading={preview?.loading}
            error={preview?.error}
          />
        </Modal>

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
