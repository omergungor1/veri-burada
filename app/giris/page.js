"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorBox, Field, inputClass } from "@/components/ui";
import { AuthCard, AuthPage } from "@/components/auth-card";

export default function GirisPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(
        err.message?.toLowerCase().includes("invalid")
          ? "E-posta veya şifre hatalı."
          : err.message,
      );
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthPage>
      <AuthCard
        title={
          <>
            Aradığınız işletmeler.
            <br />
            Tam burada.
          </>
        }
        text="Hesabınıza giriş yapın, hazır listelerinize kaldığınız yerden devam edin."
        footer={
          <>
            Hesabınız yok mu?{" "}
            <Link href="/kayit" className="font-medium text-forest hover:underline">
              Kayıt ol
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <ErrorBox message={error} />
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
          <Field label="Şifre" htmlFor="password">
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
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
            disabled={loading}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş yap"}
          </Button>
        </form>
      </AuthCard>
    </AuthPage>
  );
}
