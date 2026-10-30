import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function KayitLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAdminEmail(user.email)) redirect("/admin");

  if (user) {
    await supabase.rpc("ensure_my_profile");
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.onboarding_completed) redirect("/panel");
  }

  return children;
}
