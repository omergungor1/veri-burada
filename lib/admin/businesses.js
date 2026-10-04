// İşletme servisleri.
import { PAGE_SIZE } from "@/lib/admin/format";
import { sanitizeLike } from "@/lib/admin/projects";

export const DETAIL_STATUS_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "pending", label: "Detay bekliyor" },
  { key: "claimed", label: "Alındı" },
  { key: "completed", label: "Detaylı" },
  { key: "failed", label: "Başarısız" },
];

export async function listBusinesses(
  supabase,
  { search = "", detailStatus = "all", page = 0, pageSize = PAGE_SIZE } = {},
) {
  let q = supabase
    .from("businesses")
    .select(
      "id, place_id, name, city, district, phone, website, rating, review_count, business_type, detail_status, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (detailStatus !== "all") q = q.eq("detail_status", detailStatus);

  const s = sanitizeLike(search);
  if (s) {
    q = q.or(
      [
        `name.ilike.%${s}%`,
        `place_id.ilike.%${s}%`,
        `city.ilike.%${s}%`,
        `district.ilike.%${s}%`,
        `phone.ilike.%${s}%`,
        `full_address.ilike.%${s}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function getBusiness(supabase, id) {
  const [bizRes, resultsRes, errorsRes] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("scan_results")
      .select(
        "id, search_term, discovered_at, scan_jobs(project_id, projects(id, name))",
      )
      .eq("business_id", id)
      .order("discovered_at", { ascending: false })
      .limit(200),
    supabase
      .from("scrape_errors")
      .select("id, error_type, message, created_at")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (bizRes.error) throw bizRes.error;
  if (resultsRes.error) throw resultsRes.error;
  if (errorsRes.error) throw errorsRes.error;
  return {
    business: bizRes.data,
    results: resultsRes.data || [],
    errors: errorsRes.data || [],
  };
}
