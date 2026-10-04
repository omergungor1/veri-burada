// Kuyruk servisleri: liste görevleri (scan_tasks) ve detay kuyruğu (businesses).
import { PAGE_SIZE } from "@/lib/admin/format";

// Sekme -> durum listesi
export const LIST_TABS = [
  { key: "pending", label: "Bekleyen", statuses: ["pending"] },
  { key: "active", label: "Çalışan", statuses: ["claimed", "running"] },
  { key: "completed", label: "Tamamlanan", statuses: ["completed"] },
  { key: "failed", label: "Başarısız", statuses: ["failed"] },
  { key: "all", label: "Tümü", statuses: null },
];

export const DETAIL_TABS = [
  { key: "pending", label: "Bekleyen", statuses: ["pending"] },
  { key: "active", label: "Alınmış", statuses: ["claimed"] },
  { key: "completed", label: "Tamamlanan", statuses: ["completed"] },
  { key: "failed", label: "Başarısız", statuses: ["failed"] },
  { key: "all", label: "Tümü", statuses: null },
];

async function countBy(supabase, table, column, statuses) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (statuses) q = q.in(column, statuses);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

export async function getQueueCounts(supabase, kind) {
  const tabs = kind === "detail" ? DETAIL_TABS : LIST_TABS;
  const table = kind === "detail" ? "businesses" : "scan_tasks";
  const column = kind === "detail" ? "detail_status" : "status";
  const entries = await Promise.all(
    tabs.map(async (t) => [
      t.key,
      await countBy(supabase, table, column, t.statuses),
    ]),
  );
  return Object.fromEntries(entries);
}

export async function listQueue(
  supabase,
  { kind = "list", tab = "pending", page = 0, pageSize = PAGE_SIZE } = {},
) {
  const tabs = kind === "detail" ? DETAIL_TABS : LIST_TABS;
  const statuses = tabs.find((t) => t.key === tab)?.statuses ?? null;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  if (kind === "detail") {
    let q = supabase
      .from("businesses")
      .select(
        "id, place_id, name, city, district, detail_status, detail_attempt_count, detail_last_error, detail_claimed_at, detail_lease_expires_at, updated_at, workers:detail_worker_id(name, worker_key)",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
    if (statuses) q = q.in("detail_status", statuses);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data || [], count: count || 0 };
  }

  let q = supabase
    .from("scan_tasks")
    .select(
      "id, task_type, search_term, status, attempt_count, result_count, last_error, claimed_at, lease_expires_at, completed_at, created_at, updated_at, workers(name, worker_key), scan_jobs(project_id, projects(id, name))",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (statuses) q = q.in("status", statuses);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

/**
 * Kuyruk "Başarısız" sekmesindeki tüm failed kayıtları tekrar pending yapar.
 * kind: 'list' | 'detail'
 */
export async function retryQueueFailures(supabase, kind) {
  const { data, error } = await supabase.rpc("admin_retry_queue_failures", {
    p_kind: kind,
  });
  if (error) throw error;
  return data;
}
