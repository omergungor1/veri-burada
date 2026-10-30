"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/admin/hooks";
import { errorMessage } from "@/lib/admin/format";
import { loadAccount, updateNotifications, updateProfile } from "@/lib/panel/api";
import {
  formatTrMobile,
  isValidTrMobile,
  trMobileDigits,
} from "@/lib/panel/format";
import { Icon } from "@/components/icons";
import {
  Button,
  Card,
  CardHeader,
  DetailRow,
  ErrorBox,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  Toast,
  inputClass,
} from "@/components/ui";

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { data, error, loading, reload } = useAsyncData(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const account = await loadAccount(supabase, user.id);
    return { user, ...account };
  }, []);

  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFullName(data.profile?.full_name || "");
    setPhoneNumber(formatTrMobile(data.profile?.phone || ""));
    setEmailEnabled(data.prefs?.email_enabled !== false);
    setMarketingEnabled(Boolean(data.prefs?.marketing_email_enabled));
  }, [data]);

  function resetProfile() {
    setFullName(data?.profile?.full_name || "");
    setPhoneNumber(formatTrMobile(data?.profile?.phone || ""));
    setEditingProfile(false);
    setFormError("");
  }

  function closePassword() {
    setPasswordOpen(false);
    setNewPassword("");
    setPassword2("");
    setFormError("");
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving("profile");
    setFormError("");
    if (!fullName.trim()) {
      setFormError("Ad soyad gerekli.");
      setSaving("");
      return;
    }
    if (!isValidTrMobile(phoneNumber)) {
      setFormError("Telefon 05XX XXX XX XX formatında olmalı.");
      setSaving("");
      return;
    }
    try {
      await updateProfile(supabase, fullName.trim(), trMobileDigits(phoneNumber));
      setToast("Profil kaydedildi.");
      setEditingProfile(false);
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    }
    setSaving("");
  }

  async function savePassword(e) {
    e.preventDefault();
    setSaving("password");
    setFormError("");
    if (newPassword.length < 8) {
      setFormError("Şifre en az 8 karakter olmalı.");
      setSaving("");
      return;
    }
    if (newPassword !== password2) {
      setFormError("Şifreler eşleşmiyor.");
      setSaving("");
      return;
    }
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setFormError(errorMessage(err));
      setSaving("");
      return;
    }
    setToast("Şifre güncellendi.");
    closePassword();
    setSaving("");
  }

  async function savePrefs(e) {
    e.preventDefault();
    setSaving("prefs");
    setFormError("");
    try {
      await updateNotifications(supabase, {
        emailEnabled,
        smsEnabled: false,
        whatsappEnabled: false,
        marketingEnabled,
      });
      setToast("Bildirim tercihleri kaydedildi.");
      setPrefsOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    }
    setSaving("");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/giris");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Hesabım" description="Profil, güvenlik ve bildirim tercihlerin." />
      <ErrorBox message={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}

      {data ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Profil"
              action={
                editingProfile ? null : (
                  <Button size="sm" onClick={() => setEditingProfile(true)}>
                    Düzenle
                  </Button>
                )
              }
            />
            {editingProfile ? (
              <form onSubmit={saveProfile} className="space-y-3 p-4">
                <Field label="Ad Soyad">
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Telefon" hint="05XX XXX XX XX">
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    placeholder="05XX XXX XX XX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(formatTrMobile(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                {formError && !passwordOpen && !prefsOpen ? (
                  <p className="text-sm text-red-700">{formError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="primary" disabled={saving === "profile"}>
                    {saving === "profile" ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                  <Button type="button" onClick={resetProfile} disabled={saving === "profile"}>
                    Vazgeç
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="divide-y divide-border px-4">
                <DetailRow label="Ad Soyad">{data.profile?.full_name || "—"}</DetailRow>
                <DetailRow label="Telefon">
                  {formatTrMobile(data.profile?.phone) || "—"}
                </DetailRow>
              </dl>
            )}
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setPasswordOpen(true)}>Şifreyi değiştir</Button>
            <Button onClick={() => setPrefsOpen(true)}>Bildirim tercihlerini yönet</Button>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="danger" size="lg" onClick={logout}>
              <Icon name="logout" className="h-5 w-5" />
              Çıkış yap
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={passwordOpen}
        onClose={() => saving !== "password" && closePassword()}
        title="Şifreyi değiştir"
        footer={
          <>
            <Button disabled={saving === "password"} onClick={closePassword}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              disabled={saving === "password"}
              onClick={savePassword}
            >
              {saving === "password" ? "Kaydediliyor..." : "Şifreyi güncelle"}
            </Button>
          </>
        }
      >
        <form onSubmit={savePassword} className="space-y-3">
          <Field label="Yeni şifre">
            <input
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Yeni şifre (tekrar)">
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className={inputClass}
            />
          </Field>
          {formError && passwordOpen ? (
            <p className="text-sm text-red-700">{formError}</p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={prefsOpen}
        onClose={() => saving !== "prefs" && setPrefsOpen(false)}
        title="Bildirim tercihleri"
        footer={
          <>
            <Button disabled={saving === "prefs"} onClick={() => setPrefsOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="primary" disabled={saving === "prefs"} onClick={savePrefs}>
              {saving === "prefs" ? "Kaydediliyor..." : "Tercihleri kaydet"}
            </Button>
          </>
        }
      >
        <form onSubmit={savePrefs} className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="accent-green"
            />
            E-posta ile liste hazır bildirimi
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" disabled className="accent-green" />
            SMS ile bilgilendirme (altyapı henüz yok)
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" disabled className="accent-green" />
            WhatsApp ile bilgilendirme (altyapı henüz yok)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={marketingEnabled}
              onChange={(e) => setMarketingEnabled(e.target.checked)}
              className="accent-green"
            />
            Pazarlama e-postaları (ayrı izin)
          </label>
          {formError && prefsOpen ? (
            <p className="text-sm text-red-700">{formError}</p>
          ) : null}
        </form>
      </Modal>

      <Toast message={toast} onClose={() => setToast("")} />
    </>
  );
}
