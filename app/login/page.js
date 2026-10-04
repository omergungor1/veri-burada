"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorBox, Field, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";

export default function LoginPage() {
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
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white">
            <Icon name="building" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Harita Veri Paneli
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Yönetici girişi
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
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
              placeholder="admin@ornek.com"
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
            className="w-full"
            disabled={loading}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş yap"}
          </Button>
        </form>
      </div>
    </main>
  );
}
