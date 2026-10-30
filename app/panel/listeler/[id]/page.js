"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { PAGE_SIZE, errorMessage } from "@/lib/admin/format";
import { loadListDetail, loadListRows, unlockList } from "@/lib/panel/api";
import {
  formatListRegion,
  formatNumber,
  joinList,
  listStatus,
} from "@/lib/panel/format";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  Spinner,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { Icon } from "@/components/icons";

function downloadHref(id, kind, format) {
  return `/api/lists/${id}/download?kind=${kind}&format=${format}`;
}

export default function ListDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const listId = String(id || "");
  const [page, setPage] = useState(0);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const { data, error, loading, reload } = useAsyncData(
    () => loadListDetail(createClient(), listId),
    [listId, tick],
  );
  const { data: rowsData, loading: rowsLoading } = useAsyncData(
    () => loadListRows(createClient(), listId, page, PAGE_SIZE),
    [listId, page, tick, data?.unlocked],
  );

  const list = data?.list;
  const stats = data?.statistics;
  const unlocked = Boolean(data?.unlocked);
  const balance = Number(data?.balance || 0);
  const needed = Number(data?.credits_needed || 0);
  const missing = Math.max(0, needed - balance);
  const st = listStatus(list?.status);
  const rows = rowsData?.rows || data?.preview || [];
  const total = unlocked ? rowsData?.total || 0 : Math.min(10, rows.length);

  const valueCards = useMemo(() => {
    if (!stats) return [];
    const cards = [];
    if (stats.without_website_count > 0) {
      cards.push({
        title: `Bu listede ${formatNumber(stats.without_website_count)} web sitesi olmayan işletme bulunuyor!`,
        text: "Bu işletmeler web tasarım, dijital pazarlama ve müşteri kazanımı hizmetleri için potansiyel hedef kitlen olabilir.",
      });
    }
    if (stats.below_four_stars_count > 0) {
      cards.push({
        title: `${formatNumber(stats.below_four_stars_count)} işletmenin puanı 4 yıldızın altında.`,
        text: "Bu işletmeler müşteri deneyimi ve dijital itibar hizmetleri açısından araştırılabilecek potansiyel fırsatlar sunabilir.",
      });
    }
    return cards;
  }, [stats]);

  async function doUnlock() {
    setActionError("");
    setWorking(true);
    try {
      await unlockList(createClient(), listId);
      setConfirmOpen(false);
      setTick((n) => n + 1);
      router.refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    }
    setWorking(false);
  }

  function onUnlockClick() {
    if (list?.status !== "ready") return;
    if (needed > 0 && balance < needed) {
      setBuyOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <>
      <PageHeader
        title={list?.title || "Liste"}
        description={st.hint}
        leading={
          <ButtonLink
            href="/panel/listeler"
            size="sm"
            className="px-2"
            aria-label="Listelerime dön"
            title="Listelerime dön"
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </ButtonLink>
        }
      />
      <ErrorBox message={error || actionError} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}

      {list ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>
              {list.status === "ready" ? "Listen Hazır!" : st.label}
            </Badge>
            <span className="text-sm text-muted">
              {formatListRegion(list)}
              {" · "}
              {joinList(list.keywords)}
            </span>
          </div>

          {list.status === "processing" ? (
            <Card className="mb-4 flex items-center gap-3 p-4 text-sm text-muted">
              <Spinner className="h-5 w-5" />
              İşletme verilerini senin için topluyoruz. Gerçek ilerleme bilgisi
              henüz yok; sahte yüzde göstermiyoruz.
            </Card>
          ) : null}

          {list.status === "failed" ? (
            <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {list.error_message || st.hint}
            </Card>
          ) : null}

          {list.status === "ready" && stats ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatCard
                  label="Toplam Eşsiz İşletme"
                  value={stats.unique_business_count}
                />
                <StatCard
                  label="Web Sitesi Olmayan"
                  value={stats.without_website_count}
                />
                <StatCard
                  label="4 Yıldız Altındaki"
                  value={stats.below_four_stars_count}
                />
                <StatCard
                  label="Telefon Bilgisi Bulunan"
                  value={stats.with_phone_count}
                />
                <StatCard
                  label="Web Sitesi Bulunan"
                  value={stats.with_website_count}
                />
                <StatCard
                  label="Kullanılabilir E-posta Bulunan"
                  value={stats.with_email_count}
                />
              </div>

              {valueCards.map((card) => (
                <Card key={card.title} className="mt-3 border-mint/30 bg-pale p-4">
                  <p className="text-sm font-medium text-forest">{card.title}</p>
                  <p className="mt-1 text-sm text-forest">{card.text}</p>
                </Card>
              ))}

              <Card className="mt-4 p-4">
                <p className="text-sm font-semibold text-ink">
                  {unlocked ? "Tam liste açık" : "Tam listeyi aç"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Toplam eşsiz işletme: {formatNumber(needed)} · Gerekli kredi:{" "}
                  {formatNumber(needed)} · Krediniz: {formatNumber(balance)}
                  {!unlocked && missing > 0
                    ? ` · Eksik: ${formatNumber(missing)}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Ücretsiz 10 örnek, ücretli listenin içindeki kayıtlardır. Tam
                  listeyi açmanın bedeli {formatNumber(needed)} kredidir; örnekler
                  için ikinci bir indirim yapılmaz. Liste bir kez açıldıktan sonra
                  tekrar tekrar ücretsiz indirilebilir.
                </p>
                {!unlocked ? (
                  <Button
                    variant="primary"
                    className="mt-3"
                    disabled={working}
                    onClick={onUnlockClick}
                  >
                    Tam Listeyi Aç – {formatNumber(needed)} Kredi
                  </Button>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ButtonLink href={downloadHref(listId, "full", "csv")} variant="primary">
                      <Icon name="download" className="h-4 w-4" />
                      CSV indir
                    </ButtonLink>
                    <ButtonLink href={downloadHref(listId, "full", "xlsx")}>
                      <Icon name="download" className="h-4 w-4" />
                      XLSX indir
                    </ButtonLink>
                  </div>
                )}
              </Card>
            </>
          ) : null}

          {list.status === "ready" ? (
            <Card className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    {unlocked ? "Tam liste" : "10 örnek işletme"}
                  </h2>
                  <p className="text-xs text-muted">
                    {unlocked
                      ? "Satın alınan liste. Sonraki indirmeler kredi tüketmez."
                      : "Bu 10 kayıt ücretsizdir ve kredi düşmez."}
                  </p>
                </div>
                {!unlocked ? (
                  <div className="flex gap-2">
                    <ButtonLink href={downloadHref(listId, "preview", "csv")} size="sm">
                      Örnek CSV
                    </ButtonLink>
                    <ButtonLink href={downloadHref(listId, "preview", "xlsx")} size="sm">
                      Örnek XLSX
                    </ButtonLink>
                  </div>
                ) : null}
              </div>
              {rowsLoading && !rows.length ? <LoadingBlock /> : null}
              {!rows.length ? (
                <EmptyState title="Bu listede işletme kaydı yok." />
              ) : (
                <>
                  <TableWrap>
                    <thead>
                      <tr>
                        <Th>İşletme Adı</Th>
                        <Th>Şehir</Th>
                        <Th>Telefon</Th>
                        <Th>Web Sitesi</Th>
                        <Th>Puan</Th>
                        <Th>Adres</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <Td className="font-medium">{row.business_name || "—"}</Td>
                          <Td>{row.city || "—"}</Td>
                          <Td>{row.phone || "—"}</Td>
                          <Td className="max-w-[160px] truncate">
                            {row.website || "—"}
                          </Td>
                          <Td>
                            {row.rating != null ? formatNumber(row.rating) : "—"}
                          </Td>
                          <Td className="max-w-[220px] truncate" title={row.address}>
                            {row.address || "—"}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                  {unlocked ? (
                    <Pagination
                      page={page}
                      pageSize={PAGE_SIZE}
                      count={total}
                      onChange={setPage}
                    />
                  ) : null}
                </>
              )}
            </Card>
          ) : null}
        </>
      ) : null}

      <Modal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        title="Yeterli Krediniz Bulunmuyor"
        footer={
          <ButtonLink href="/panel/krediler" variant="primary">
            Kredi Satın Al
          </ButtonLink>
        }
      >
        <p className="text-sm text-muted">
          Bu listeyi açabilmek için {formatNumber(needed)} krediye ihtiyacınız var.
          Mevcut bakiyeniz {formatNumber(balance)} kredi.
        </p>
        <p className="mt-2 text-sm text-muted">
          En az {formatNumber(missing)} kredi daha yüklemeniz gerekiyor.
        </p>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Listeyi aç"
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>Vazgeç</Button>
            <Button variant="primary" disabled={working} onClick={doUnlock}>
              {working
                ? "Açılıyor..."
                : `${formatNumber(needed)} Kredi Kullan ve Listeyi Aç`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Bu listeyi açmak için {formatNumber(needed)} krediniz kullanılacak.
          Listeyi daha sonra sınırsız kez tekrar indirebilirsiniz.
        </p>
        {needed === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Bu listede işletme olmadığı için kredi alınmayacak.
          </p>
        ) : null}
      </Modal>
    </>
  );
}
