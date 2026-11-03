"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  cx,
  inputClass,
} from "@/components/ui";
import { AuthCard, AuthPage, StepTrack } from "@/components/auth-card";
import ListRequestForm from "@/components/list-request-form";
import {
  USAGE_PURPOSES,
  USER_TYPES,
  firstName,
  formatTrMobile,
  isValidTrMobile,
  trMobileDigits,
} from "@/lib/panel/format";
import { createListRequest, saveOnboarding } from "@/lib/panel/api";
import { errorMessage } from "@/lib/admin/format";

const STEP_LABELS = [
  "Kullanım amacı",
  "Sizi tanımlayan",
  "Liste adı",
  "Ürün",
  "Bölge",
  "Sektör",
  "Özet",
  "Hoş geldin",
];

function visibleStep(step, listPart) {
  if (step <= 3) return step - 1;
  if (step === 4) return 2 + listPart;
  return STEP_LABELS.length;
}

function resumeOnboardingStep(profile, answers) {
  if (profile?.onboarding_completed) return 5;
  const stored = Number(profile?.onboarding_step || 2);
  const hasType = Boolean(answers?.user_type);
  if (stored >= 4) return 4;
  if (stored >= 3 && hasType) return 4;
  if (stored >= 3) return 3;
  return 2;
}

function ChoiceButton({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-xl border p-4 text-left text-sm transition-colors",
        selected
          ? "border-green bg-pale ring-2 ring-green"
          : "border-border bg-white hover:bg-pale",
      )}
    >
      <p className="font-semibold text-ink">{children}</p>
    </button>
  );
}

export default function KayitPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdList, setCreatedList] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [purposes, setPurposes] = useState([]);
  const [userType, setUserType] = useState("");
  const [listPart, setListPart] = useState(1);

  const phone = phoneNumber.trim() ? trMobileDigits(phoneNumber) : "";

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(current || null);
      if (current) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", current.id)
          .maybeSingle();
        const { data: answers } = await supabase
          .from("onboarding_responses")
          .select("*")
          .eq("user_id", current.id)
          .maybeSingle();
        if (cancelled) return;
        setFullName(profile?.full_name || current.user_metadata?.full_name || "");
        setEmail(current.email || "");
        setPhoneNumber(formatTrMobile(profile?.phone || ""));
        setPurposes(answers?.usage_purposes || []);
        setUserType(answers?.user_type || "");
        setStep(resumeOnboardingStep(profile, answers));
      }
      setLoading(false);
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function togglePurpose(value) {
    setPurposes((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
  }

  async function submitStep1(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) {
      setError("Ad soyad zorunludur.");
      return;
    }
    if (phoneNumber.trim() && !isValidTrMobile(phoneNumber)) {
      setError("Telefon 05XX XXX XX XX formatında olmalı.");
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), phone: phone || null },
      },
    });
    if (err) {
      setError(
        err.message?.toLowerCase().includes("already")
          ? "Bu e-posta ile kayıtlı bir hesap var. Giriş yapmayı deneyin."
          : errorMessage(err),
      );
      setSaving(false);
      return;
    }
    if (!data.session) {
      setError(
        "Hesabınız oluşturuldu ancak e-posta doğrulaması açık görünüyor. Supabase Auth ayarlarında Confirm email seçeneğini kapatın; aksi halde onboarding devam edemez.",
      );
      setSaving(false);
      return;
    }
    try {
      await saveOnboarding(supabase, {
        step: 2,
        fullName: fullName.trim(),
        phone,
      });
      setUser(data.user);
      setStep(2);
    } catch (ex) {
      setError(errorMessage(ex));
    }
    setSaving(false);
  }

  async function submitPurposes(e) {
    e.preventDefault();
    setError("");
    if (!purposes.length) {
      setError("En az bir kullanım amacı seçin.");
      return;
    }
    setSaving(true);
    try {
      await saveOnboarding(supabase, {
        step: 3,
        fullName: fullName.trim(),
        phone,
        usagePurposes: purposes,
      });
      setStep(3);
    } catch (ex) {
      setError(errorMessage(ex));
    }
    setSaving(false);
  }

  async function submitUserType(e) {
    e.preventDefault();
    setError("");
    if (!userType) {
      setError("Sizi tanımlayan seçeneği işaretleyin.");
      return;
    }
    setSaving(true);
    try {
      await saveOnboarding(supabase, {
        step: 4,
        fullName: fullName.trim(),
        phone,
        userType,
      });
      setStep(4);
    } catch (ex) {
      setError(errorMessage(ex));
    }
    setSaving(false);
  }

  async function createFirstList(payload) {
    setError("");
    setSaving(true);
    try {
      await createListRequest(supabase, payload);
      await saveOnboarding(supabase, { step: 5, complete: true });
      setCreatedList(true);
      setStep(5);
    } catch (ex) {
      setError(errorMessage(ex));
    }
    setSaving(false);
  }

  async function skipList() {
    setError("");
    setSaving(true);
    try {
      await saveOnboarding(supabase, { step: 5, complete: true });
      setCreatedList(false);
      setStep(5);
    } catch (ex) {
      setError(errorMessage(ex));
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-paper text-sm text-muted">
        Yükleniyor...
      </main>
    );
  }

  return (
    <AuthPage>
      {step === 1 ? (
        <AuthCard
          closeHref="/giris"
          title={
            <>
              Aradığınız işletmeler.
              <br />
              Tam burada.
            </>
          }
          text="Hesabınızı oluşturun, ilk işletme araştırmanızı başlatın."
          footer={
            <>
              Zaten hesabınız var mı?{" "}
              <Link href="/giris" className="font-medium text-forest hover:underline">
                Giriş yap
              </Link>
            </>
          }
        >
          <form onSubmit={submitStep1} className="space-y-3">
            <ErrorBox message={error} />
            <Field label="Ad Soyad" htmlFor="fullName">
              <input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                placeholder="Ad Soyad"
              />
            </Field>
            <Field label="E-posta" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="eposta@ornek.com"
              />
            </Field>
            <Field
              label="Telefon (opsiyonel)"
              htmlFor="phone"
              hint={
                phoneNumber.trim()
                  ? "Telefon vermek pazarlama izni anlamına gelmez."
                  : "Listeniz hazır olunca SMS veya WhatsApp ile haber verebiliriz."
              }
            >
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatTrMobile(e.target.value))}
                placeholder="05XX XXX XX XX"
                className={inputClass}
              />
            </Field>
            <Field label="Şifre" htmlFor="password">
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-1 w-full rounded-xl font-semibold"
              disabled={saving}
            >
              {saving ? "Hesap oluşturuluyor..." : "Hesap oluştur"}
            </Button>
          </form>
        </AuthCard>
      ) : (
        <div className="w-full max-w-lg space-y-5">
          <StepTrack step={visibleStep(step, listPart)} labels={STEP_LABELS} />
          <ErrorBox message={error} />

          {step === 2 ? (
            <form onSubmit={submitPurposes} className="space-y-5">
              <Card className="p-5">
                <h2 className="text-lg font-semibold text-ink">
                  Sizi biraz tanıyalım
                </h2>
                <p className="mt-1 text-sm text-muted">
                  İhtiyaçlarınıza göre deneyimi sade tutacağız.
                </p>
              </Card>

              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-ink">
                  Nasıl kullanacaksınız?
                </h2>
                <p className="text-sm text-muted">Birden fazla seçebilirsiniz.</p>
                {USAGE_PURPOSES.map((item) => (
                  <ChoiceButton
                    key={item}
                    selected={purposes.includes(item)}
                    onClick={() => togglePurpose(item)}
                  >
                    {item}
                  </ChoiceButton>
                ))}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full rounded-xl font-semibold shadow-md shadow-green/25"
                disabled={saving}
              >
                {saving ? "Kaydediliyor..." : "Devam et"}
              </Button>
            </form>
          ) : null}

          {step === 3 ? (
            <form onSubmit={submitUserType} className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-ink">
                  Hangisi sizi tanımlıyor?
                </h2>
                {USER_TYPES.map((item) => (
                  <ChoiceButton
                    key={item}
                    selected={userType === item}
                    onClick={() => setUserType(item)}
                  >
                    {item}
                  </ChoiceButton>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="lg"
                  className="rounded-xl"
                  disabled={saving}
                  onClick={() => {
                    setError("");
                    setStep(2);
                  }}
                >
                  Geri
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="flex-1 rounded-xl font-semibold shadow-md shadow-green/25"
                  disabled={saving}
                >
                  {saving ? "Kaydediliyor..." : "Devam et"}
                </Button>
              </div>
            </form>
          ) : null}

          {step === 4 ? (
            <ListRequestForm
              compact
              submitting={saving}
              submitLabel="İlk Listemi Oluştur"
              onStepChange={setListPart}
              onSubmit={createFirstList}
              extraActions={
                <Button onClick={skipList} disabled={saving}>
                  Şimdilik atla
                </Button>
              }
            />
          ) : null}

          {step === 5 ? (
            <Card className="p-5 text-center sm:p-7">
              <h2 className="text-xl font-semibold text-ink">
                Veri Burada&apos;ya hoş geldin
                {firstName(fullName) ? `, ${firstName(fullName)}` : ""}!
              </h2>
              <p className="mt-3 text-sm text-muted">
                İşletme verilerine ulaşmak için her şey hazır.
              </p>
              <p className="mt-2 text-sm text-muted">
                {createdList
                  ? "İlk liste talebini aldık. Listen hazır olduğunda sana haber vereceğiz."
                  : "İlk işletme listeni oluşturarak hemen başlayabilirsin."}
              </p>
              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full rounded-xl font-semibold"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await saveOnboarding(supabase, { step: 5, complete: true });
                    router.replace("/panel");
                    router.refresh();
                  } catch (ex) {
                    setError(errorMessage(ex));
                    setSaving(false);
                  }
                }}
              >
                Panele git
              </Button>
            </Card>
          ) : null}
        </div>
      )}
    </AuthPage>
  );
}
