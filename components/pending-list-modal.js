"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Modal, cx } from "@/components/ui";

export function PendingListModal({ open, listTitle, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Liste talebiniz oluşturuldu"
      footer={
        <Button variant="primary" onClick={onClose}>
          Tamam
        </Button>
      }
    >
      {listTitle ? <p className="text-sm font-medium text-ink">{listTitle}</p> : null}
      <p className={listTitle ? "mt-2 text-sm text-muted" : "text-sm text-muted"}>
        Sunucuların iş yüküne göre yaklaşık 1 gün sürebilir. İşlem tamamlanınca
        bildirim ve e-posta alacaksınız.
      </p>
    </Modal>
  );
}

export function ListRequestLink({ row, className, title, children }) {
  const [open, setOpen] = useState(false);
  const shared = cx("w-full text-left", className);

  function showNotice() {
    setOpen(true);
  }

  if (row?.status === "queued") {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          title={title}
          onClick={showNotice}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              showNotice();
            }
          }}
          className={shared}
        >
          {children}
        </div>
        <PendingListModal
          open={open}
          listTitle={row.title}
          onClose={() => setOpen(false)}
        />
      </>
    );
  }

  return (
    <Link href={`/panel/listeler/${row.id}`} title={title} className={shared}>
      {children}
    </Link>
  );
}
