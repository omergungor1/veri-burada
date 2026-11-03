"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { errorMessage } from "@/lib/admin/format";
import { createSupportMessage, loadSupportMessages } from "@/lib/panel/api";
import { formatDate, SUPPORT_KINDS, SUPPORT_STATUS } from "@/lib/panel/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  LoadingBlock,
  PageHeader,
  Toast,
  cx,
  inputClass,
} from "@/components/ui";

const KINDS = Object.entries(SUPPORT_KINDS);

export default function ContactPage() {
  const supabase = useMemo(() => createClient(), []);
  const { data, error, loading, reload } = useAsyncData(
    () => loadSupportMessages(supabase),
    [supabase],
  );
  const [kind, setKind] = useState("suggestion");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    const text = body.trim();
    if (text.length < 10) {
      setFormError("Mesaj en az 10 karakter olmalı.");
      return;
    }
    setSaving(true);
    try {
      await createSupportMessage(supabase, { kind, body: text });
      setBody("");
      setToast("Mesajın bize ulaştı. En kısa sürede dönüş yapacağız.");
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    }
    setSaving(false);
  }

  const messages = data || [];

  return (
    <>
      <PageHeader
        title="Bize ulaşın"
        description="Öneri, sorun veya şikayetini buradan ilet. Mesajın ekibimize düşer."
      />
      <ErrorBox message={error} onRetry={reload} />
      <Toast message={toast} onClose={() => setToast("")} />

      <Card className="p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <ErrorBox message={formError} />
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Ne bildirmek istiyorsun?</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {KINDS.map(([id, item]) => {
                const on = kind === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setKind(id)}
                    className={cx(
                      "rounded-xl border p-3 text-left transition-colors",
                      on
                        ? "border-green bg-pale ring-2 ring-green"
                        : "border-border bg-white hover:bg-pale",
                    )}
                  >
                    <p className="text-sm font-semibold text-ink">{item.label}</p>
                    <p className="mt-1 text-xs text-muted">{item.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Mesajın" htmlFor="support-body">
            <textarea
              id="support-body"
              rows={5}
              required
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Kısaca yazman yeterli."
              className={inputClass}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="rounded-xl font-semibold"
            disabled={saving}
          >
            {saving ? "Gönderiliyor..." : "Gönder"}
          </Button>
        </form>
      </Card>

      <div className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-ink">Gönderdiklerin</h2>
        {loading && !data ? (
          <Card>
            <LoadingBlock />
          </Card>
        ) : messages.length === 0 ? (
          <Card>
            <EmptyState title="Henüz bir mesajın yok." />
          </Card>
        ) : (
          <div className="space-y-2">
            {messages.map((row) => {
              const kindInfo = SUPPORT_KINDS[row.kind] || {
                label: row.kind,
                tone: "zinc",
              };
              const status = SUPPORT_STATUS[row.status] || {
                label: row.status,
                tone: "zinc",
              };
              return (
                <Card key={row.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={kindInfo.tone}>{kindInfo.label}</Badge>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="text-xs text-muted">{formatDate(row.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{row.body}</p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
