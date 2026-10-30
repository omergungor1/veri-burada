"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createListRequest } from "@/lib/panel/api";
import { errorMessage } from "@/lib/admin/format";
import ListRequestForm from "@/components/list-request-form";
import { Button, ButtonLink, ErrorBox, Modal, PageHeader } from "@/components/ui";

export default function NewListPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function onSubmit(payload) {
    setError("");
    setSubmitting(true);
    try {
      await createListRequest(createClient(), payload);
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    }
    setSubmitting(false);
  }

  return (
    <>
      <PageHeader
        title="Yeni liste"
        description="Adım adım bölge ve sektörü seç, liste talebini oluşturalım."
      />
      <ErrorBox message={error} />
      <ListRequestForm submitting={submitting} onSubmit={onSubmit} />

      <Modal
        open={success}
        onClose={() => setSuccess(false)}
        title="Tebrikler! Liste talebini aldık 🎉"
        footer={
          <>
            <ButtonLink href="/panel/listeler" variant="primary">
              Listelerime Git
            </ButtonLink>
            <Button
              onClick={() => {
                setSuccess(false);
                router.refresh();
              }}
            >
              Yeni Liste Oluştur
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          İşletme listeni hazırlamaya başladığımızda süreci panelinden takip
          edebilirsin. Listen genellikle 1 iş günü içinde hazır olur.
        </p>
        <p className="mt-3 text-sm text-muted">
          Listen hazır olduğunda sana e-posta ile haber vereceğiz.
        </p>
      </Modal>
    </>
  );
}
