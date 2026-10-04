import { createBrowserClient } from "@supabase/ssr";

// Tarayıcı (client component) için Supabase istemcisi.
// Sadece anon key kullanılır; service_role anahtarı asla istemciye girmez.
let browserClient;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
