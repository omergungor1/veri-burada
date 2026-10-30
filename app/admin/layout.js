import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell, { ADMIN_NAV } from "@/components/admin-shell";
import { isAdminEmail } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris");
  if (!isAdminEmail(user.email)) redirect("/panel");

  await supabase.rpc("ensure_my_profile");

  return (
    <AppShell
      email={user.email || ""}
      nav={ADMIN_NAV}
      homeHref="/admin"
      brandSubtitle="Admin Panel"
      collapseKey="vb_admin_sidebar_collapsed"
    >
      {children}
    </AppShell>
  );
}
