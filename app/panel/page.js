"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { loadDashboard } from "@/lib/panel/api";
import {
  formatDate,
  formatNumber,
  firstName,
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
  StatCard,
} from "@/components/ui";
import { Icon } from "@/components/icons";

function shortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function PanelDashboardPage() {
  const { data, error, loading, reload } = useAsyncData(
    () => loadDashboard(createClient()),
    [],
  );

  const profile = data?.profile;
  const counts = data?.counts || {};
  const recent = data?.recent || [];
  const name = firstName(profile?.full_name);

  return (
    <>
      <PageHeader
        title="Genel bakış"
        description={
          name
            ? `${name}, kredi bakiyen ve liste taleplerinin özeti.`
            : "Kredi bakiyen ve liste taleplerinin özeti."
        }
        actions={
          <ButtonLink href="/panel/listeler/yeni" variant="primary">
            <Icon name="plus" className="h-4 w-4" />
            Yeni Liste Oluştur
          </ButtonLink>
        }
      />
      <ErrorBox message={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Toplam Liste Talebim" value={counts.total} />
            <StatCard label="Hazır Listelerim" value={counts.ready} tone="green" />
            <StatCard
              label="Hazırlanan Listeler"
              value={counts.preparing}
              tone="amber"
            />
            <StatCard label="Mevcut Kredim" value={data.balance} />
          </div>

          {counts.ready_locked > 0 ? (
            <Card className="mt-4 border-mint/40 bg-pale p-4">
              <p className="text-sm font-medium text-forest">
                {formatNumber(counts.ready_locked)} listen hazır! İşletme
                verilerini keşfetmeye başlayabilirsin.
              </p>
              <ButtonLink href="/panel/listeler" size="sm" className="mt-3">
                Listelerime git
              </ButtonLink>
            </Card>
          ) : null}

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">
                Son Listelerim
              </h2>
              {recent.length > 0 ? (
                <ButtonLink href="/panel/listeler" size="sm" variant="ghost">
                  Tümü
                </ButtonLink>
              ) : null}
            </div>
            {recent.length === 0 ? (
              <Card>
                <EmptyState
                  title="Henüz bir işletme listen yok."
                  description="İlk listeni oluşturarak binlerce potansiyel işletmeye ulaşabilirsin."
                  action={
                    <ButtonLink href="/panel/listeler/yeni" variant="primary">
                      İlk Listemi Oluştur
                    </ButtonLink>
                  }
                />
              </Card>
            ) : (
              <div className="space-y-2">
                {recent.map((row) => {
                  const st = listStatus(row.status);
                  return (
                    <Link
                      key={row.id}
                      href={`/panel/listeler/${row.id}`}
                      title={formatDate(row.created_at)}
                      className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 shadow-sm hover:border-muted hover:bg-pale"
                    >
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {row.title}
                      </p>
                      <span className="hidden shrink-0 whitespace-nowrap text-xs text-muted sm:inline">
                        {shortDate(row.created_at)}
                      </span>
                      <Badge tone={st.tone} className="shrink-0">
                        {st.label}
                      </Badge>
                      <span className="w-12 shrink-0 text-right text-sm tabular-nums whitespace-nowrap text-ink">
                        {row.status === "ready"
                          ? formatNumber(row.business_count)
                          : "—"}
                      </span>
                      <Icon
                        name="chevronRight"
                        className="h-4 w-4 shrink-0 text-muted"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
