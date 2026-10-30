import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell, { CUSTOMER_NAV } from "@/components/admin-shell";
import { isAdminEmail } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris");
  if (isAdminEmail(user.email)) redirect("/admin");

  await supabase.rpc("ensure_my_profile");
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) redirect("/kayit");

  const { data: wallet } = await supabase
    .from("credit_wallets")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppShell
      email={user.email || ""}
      nav={CUSTOMER_NAV}
      homeHref="/panel"
      brandSubtitle="Müşteri Paneli"
      collapseKey="vb_customer_sidebar_collapsed"
      creditBalance={wallet?.balance ?? 0}
      creditHref="/panel/krediler"
    >
      {children}
    </AppShell>
  );
}
