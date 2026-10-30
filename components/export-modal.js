"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAllProjectBusinesses } from "@/lib/admin/projects";
import {
  CSV_COLUMNS,
  buildCsv,
  downloadCsv,
  slugifyFilename,
} from "@/lib/admin/csv";
import { errorMessage, formatNumber } from "@/lib/admin/format";
import { Button, ErrorBox, Modal } from "@/components/ui";

export default function ExportModal({ open, onClose, project, jobIds }) {
  const [selected, setSelected] = useState(
    () => new Set(CSV_COLUMNS.filter((c) => c.default).map((c) => c.key)),
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setAll(on) {
    setSelected(on ? new Set(CSV_COLUMNS.map((c) => c.key)) : new Set());
  }

  async function onExport() {
    setError("");
    setProgress(0);
    setBusy(true);
    try {
      const rows = await fetchAllProjectBusinesses(createClient(), jobIds, {
        onProgress: setProgress,
      });
      if (rows.length === 0) {
        setError("Dışa aktarılacak işletme bulunamadı.");
        return;
      }
      const keys = CSV_COLUMNS.filter((c) => selected.has(c.key)).map(
        (c) => c.key,
      );
      const csv = buildCsv(rows, keys);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`${slugifyFilename(project?.name)}-${stamp}.csv`, csv);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="CSV dışa aktar"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            onClick={onExport}
            disabled={busy || selected.size === 0}
          >
            {busy
              ? `İndiriliyor... (${formatNumber(progress)})`
              : "CSV indir"}
          </Button>
        </>
      }
    >
      <ErrorBox message={error} />
      <p className="mb-3 text-sm text-muted">
        Her işletme için tek satır oluşturulur. Arama terimleri{" "}
        <code className="rounded bg-pale px-1">
          {" | "}
        </code>{" "}
        ile birleştirilir.
      </p>
      <div className="mb-3 flex gap-2">
        <Button size="sm" onClick={() => setAll(true)} disabled={busy}>
          Tümünü seç
        </Button>
        <Button size="sm" onClick={() => setAll(false)} disabled={busy}>
          Temizle
        </Button>
        <span className="ml-auto self-center text-xs text-muted">
          {selected.size}/{CSV_COLUMNS.length} sütun
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {CSV_COLUMNS.map((c) => (
          <label
            key={c.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm text-ink hover:bg-pale"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-green"
              checked={selected.has(c.key)}
              onChange={() => toggle(c.key)}
              disabled={busy}
            />
            <span className="font-mono text-xs">{c.header}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
