"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { errorMessage, formatNumber } from "@/lib/admin/format";
import { createProject } from "@/lib/admin/projects";
import {
  generateSearchTerms,
  parseKeywords,
  projectSeedFromList,
} from "@/lib/admin/keyword-planner";
import {
  adminCompleteList,
  adminFailList,
  adminLoadListRequests,
  adminSetProcessing,
} from "@/lib/panel/api";
import {
  formatDate,
  formatListRegion,
  joinList,
  listStatus,
  REQUEST_TYPE_LABELS,
} from "@/lib/panel/format";
import ProjectForm from "@/components/project-form";
import { Icon } from "@/components/icons";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  Modal,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

function termsForList(row) {
  const seed = projectSeedFromList(row);
  const keywords = parseKeywords(seed.keywordsText);
  const list = keywords.length ? keywords : parseKeywords(seed.keyword);
  return {
    seed,
    terms: generateSearchTerms(list, seed.provinceIds, {
      districts: seed.districts,
    }),
  };
}

function RowMenu({ busy, items }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [box, setBox] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 220;
      const height = menuRef.current?.offsetHeight || items.length * 36 + 8;
      let top = rect.bottom + 6;
      if (top + height > window.innerHeight - 8) {
        top = Math.max(8, rect.top - height - 6);
      }
      const left = Math.min(
        Math.max(8, rect.right - width),
        window.innerWidth - width - 8,
      );
      setBox({ top, left, width });
    }
    place();
    function onDoc(e) {
      if (buttonRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, items.length]);

  const menu =
    open && box
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: box.top, left: box.left, width: box.width }}
            className="fixed z-[60] rounded-lg border border-border bg-white p-1 shadow-lg"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={
                  item.danger
                    ? "block w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    : "block w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-pale disabled:opacity-60"
                }
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Button
        ref={buttonRef}
        size="sm"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="İşlemler"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" className="h-4 w-4" />
      </Button>
      {menu}
    </>
  );
}

export default function AdminListRequestsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { data, error, loading, reload } = useAsyncData(
    () => adminLoadListRequests(supabase),
    [],
  );
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState(null);

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

  async function onProjectCreated(result) {
    const row = draft;
    if (!row) return;
    if (row.status === "queued" || row.status === "failed") {
      try {
        await adminSetProcessing(createClient(), row.id);
      } catch (err) {
        setDraft(null);
        setMsg(
          `Proje oluşturuldu. Liste durumu güncellenemedi: ${errorMessage(err)}`,
        );
        reload();
        return;
      }
      setMsg("Proje oluşturuldu. Liste hazırlanıyor.");
    } else {
      setMsg("Proje oluşturuldu.");
    }
    setDraft(null);
    reload();
  }

  async function rescan(row) {
    const { seed, terms } = termsForList(row);
    if (!seed.keyword) {
      setMsg("Tekrar tarama için anahtar kelime yok.");
      return;
    }
    if (!seed.provinceIds.length) {
      setMsg("Tekrar tarama için il bulunamadı.");
      return;
    }
    if (!terms.length) {
      setMsg("Bu talep için arama terimi üretilemedi.");
      return;
    }
    const ok = window.confirm(
      `${formatNumber(terms.length)} arama terimiyle aynı tarama yeniden kuyruğa alınsın mı?`,
    );
    if (!ok) return;

    const stamp = new Date().toLocaleDateString("tr-TR", {
      month: "long",
      year: "numeric",
    });
    await run(row.id, () =>
      createProject(createClient(), {
        name: `${seed.name} · ${stamp}`,
        keyword: seed.keyword,
        location:
          seed.location ||
          (row.cities || []).join(", ") ||
          "Tüm Türkiye",
        searchTerms: terms,
      }),
      "Aynı tarama yeni proje olarak kuyruğa alındı.",
    );
  }

  const rows = data || [];

  return (
    <>
      <PageHeader
        title="Müşteri liste talepleri"
        description="Talebi proje olarak ekleyince liste hazırlanıyor olur. Hazır listelerde aynı taramayı yeniden kuyruğa alabilirsin."
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
                const items = [
                  {
                    label: "Proje olarak ekle",
                    onClick: () => setDraft(row),
                  },
                ];
                if (row.status === "ready") {
                  items.push({
                    label: "Tekrar tara",
                    onClick: () => rescan(row),
                  });
                } else {
                  items.push(
                    {
                      label: "Envanterden doldur",
                      onClick: () =>
                        run(
                          row.id,
                          () => adminCompleteList(supabase, row.id),
                          "Envanterden dolduruldu ve hazırlandı.",
                        ),
                    },
                    {
                      label: "Başarısız",
                      danger: true,
                      onClick: () =>
                        run(
                          row.id,
                          () =>
                            adminFailList(
                              supabase,
                              row.id,
                              "Talep hazırlanamadı.",
                            ),
                          "Başarısız işaretlendi.",
                        ),
                    },
                  );
                }
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-pale"
                    onClick={() => router.push(`/admin/list-requests/${row.id}`)}
                  >
                    <Td>
                      <p className="font-medium">{profile.full_name || "—"}</p>
                      <p className="text-xs text-muted">{profile.email}</p>
                    </Td>
                    <Td>
                      <p className="font-medium text-ink">{row.title}</p>
                      <p className="max-w-[240px] truncate text-xs text-muted">
                        {REQUEST_TYPE_LABELS[row.request_type] || "Liste"} ·{" "}
                        {joinList(row.keywords)} · {formatListRegion(row)}
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
                    <Td onClick={(e) => e.stopPropagation()}>
                      <RowMenu busy={busy} items={items} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Modal
        wide
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title="Proje olarak ekle"
      >
        {draft ? (
          <ProjectForm
            key={draft.id}
            embedded
            initial={projectSeedFromList(draft)}
            onCreated={onProjectCreated}
          />
        ) : null}
      </Modal>
    </>
  );
}
