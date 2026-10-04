import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  // proxy.js ilk savunma hattı; burada ikinci kontrol yapılır.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <AdminShell email={user.email || ""}>{children}</AdminShell>;
}
