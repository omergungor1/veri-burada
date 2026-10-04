"use client";

import { use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { getBusiness } from "@/lib/admin/businesses";
import { formatDate, formatNumber } from "@/lib/admin/format";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  DetailRow,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { Icon } from "@/components/icons";

function ExternalLink({ href, children }) {
  if (!href) return "-";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 break-all text-green-700 hover:underline dark:text-green-400"
    >
      {children || href}
      <Icon name="external" className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

export default function BusinessDetailPage({ params }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useAsyncData(
    () => getBusiness(createClient(), id),
    [id],
  );

  if (loading && !data) return <LoadingBlock />;

  const b = data?.business;

  return (
    <>
      <Link
        href="/admin/businesses"
        className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        İşletmeler
      </Link>
      <ErrorBox message={error} onRetry={reload} />

      {data && !b ? (
        <Card>
          <EmptyState title="İşletme bulunamadı" />
        </Card>
      ) : null}

      {b ? (
        <>
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                {b.name || "(isimsiz)"}
                <StatusBadge
                  status={b.detail_status}
                  label={b.detail_status === "completed" ? "Detaylı" : undefined}
                />
              </span>
            }
            description={[b.business_type, b.district, b.city]
              .filter(Boolean)
              .join(" · ")}
            actions={
              b.google_maps_url ? (
                <ButtonLink
                  href={b.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="external" className="h-4 w-4" />
                  Google Maps
                </ButtonLink>
              ) : null
            }
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Bilgiler" />
              <dl className="divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
                <DetailRow label="Place ID">
                  <span className="font-mono text-xs">{b.place_id}</span>
                </DetailRow>
                <DetailRow label="CID">{b.cid}</DetailRow>
                <DetailRow label="Adres">{b.full_address}</DetailRow>
                <DetailRow label="İl / İlçe">
                  {[b.city, b.district].filter(Boolean).join(" / ") || null}
                </DetailRow>
                <DetailRow label="Plus Code">{b.plus_code}</DetailRow>
                <DetailRow label="Telefon">{b.phone}</DetailRow>
                <DetailRow label="Website">
                  <ExternalLink href={b.website} />
                </DetailRow>
                <DetailRow label="Puan">
                  {b.rating !== null && b.rating !== undefined
                    ? `${b.rating} (${formatNumber(b.review_count)} yorum)`
                    : null}
                </DetailRow>
                <DetailRow label="Koordinat">
                  {b.lat !== null && b.lng !== null ? `${b.lat}, ${b.lng}` : null}
                </DetailRow>
                <DetailRow label="Çalışma saatleri">
                  {b.working_hours ? (
                    <span className="whitespace-pre-line">{b.working_hours}</span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Görsel">
                  <ExternalLink href={b.image_url} />
                </DetailRow>
              </dl>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title="Detay tarama" />
                <dl className="divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
                  <DetailRow label="Durum">
                    <StatusBadge status={b.detail_status} />
                  </DetailRow>
                  <DetailRow label="Deneme">{b.detail_attempt_count}</DetailRow>
                  <DetailRow label="Detaylanma">{formatDate(b.detailed_at)}</DetailRow>
                  <DetailRow label="Sonraki tarama">
                    {formatDate(b.next_detail_scan_at)}
                  </DetailRow>
                  <DetailRow label="Son hata">
                    {b.detail_last_error ? (
                      <span className="text-red-600 dark:text-red-400">
                        {b.detail_last_error}
                      </span>
                    ) : null}
                  </DetailRow>
                  <DetailRow label="Oluşturulma">{formatDate(b.created_at)}</DetailRow>
                  <DetailRow label="Güncellenme">{formatDate(b.updated_at)}</DetailRow>
                </dl>
              </Card>

              <Card>
                <CardHeader
                  title="Arama terimleri"
                  subtitle={`${data.results.length} kayıt`}
                />
                {data.results.length === 0 ? (
                  <EmptyState title="Kayıt yok" />
                ) : (
                  <ul className="thin-scroll max-h-80 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
                    {data.results.map((r) => {
                      const project = r.scan_jobs?.projects;
                      return (
                        <li key={r.id} className="px-4 py-2 text-sm">
                          <p className="break-words text-zinc-800 dark:text-zinc-200">
                            {r.search_term || "-"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {project ? (
                              <Link
                                href={`/admin/projects/${project.id}`}
                                className="text-green-700 hover:underline dark:text-green-400"
                              >
                                {project.name}
                              </Link>
                            ) : null}
                            {project ? " · " : ""}
                            {formatDate(r.discovered_at)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {data.errors.length > 0 ? (
            <Card className="mt-4">
              <CardHeader title="Hatalar" />
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.errors.map((e) => (
                  <li key={e.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone="red">{e.error_type || "hata"}</Badge>
                      <span className="text-xs text-zinc-500">
                        {formatDate(e.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-zinc-800 dark:text-zinc-200">
                      {e.message}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}
