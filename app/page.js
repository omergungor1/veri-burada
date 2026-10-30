import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathForEmail } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris");
  redirect(homePathForEmail(user.email));
}
