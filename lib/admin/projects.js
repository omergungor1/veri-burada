// Proje servisleri.
import { PAGE_SIZE } from "@/lib/admin/format";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** Liste (scan_tasks) ilerlemesi — scan_jobs sayaçlarından. */
export function summarizeJobs(jobs = []) {
  const total = jobs.reduce((s, j) => s + (j.total_tasks || 0), 0);
  const completed = jobs.reduce((s, j) => s + (j.completed_tasks || 0), 0);
  const failed = jobs.reduce((s, j) => s + (j.failed_tasks || 0), 0);
  const found = jobs.reduce((s, j) => s + (j.businesses_found || 0), 0);
  return { total, completed, failed, found, done: completed + failed };
}

/** Detay (businesses.detail_status) ilerlemesi. */
export function summarizeDetail(stats = {}) {
  const total = Number(stats.total) || 0;
  const completed = Number(stats.completed) || 0;
  const failed = Number(stats.failed) || 0;
  const pending = Number(stats.pending) || 0;
  const active = Number(stats.active) || 0;
  return {
    total,
    completed,
    failed,
    pending,
    active,
    done: completed + failed,
  };
}

/** Liste + detay özetini tek nesnede toplar. */
export function summarizeProjectProgress(project, detailStats) {
  return {
    list: summarizeJobs(project?.scan_jobs || []),
    detail: summarizeDetail(detailStats),
  };
}

function emptyDetailProgress() {
  return { total: 0, completed: 0, failed: 0, pending: 0, active: 0 };
}

function progressRpcMissing(error) {
  const message = `${error?.message || ""} ${error?.code || ""}`;
  return /get_projects_detail_progress|PGRST202|schema cache/i.test(message);
}

/** Fonksiyon yokken kullanılan yedek. Sonuç satırlarını sayfa sayfa indirir. */
async function fetchDetailProgressLegacy(supabase, projects, byProject) {
  const jobToProject = new Map();
  for (const p of projects) {
    for (const j of p.scan_jobs || []) jobToProject.set(j.id, p.id);
  }
  const jobIds = [...jobToProject.keys()];
  if (!jobIds.length) return byProject;

  const seen = new Set();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("scan_results")
      .select("scan_job_id, business_id, businesses(detail_status)")
      .in("scan_job_id", jobIds)
      .range(from, from + page - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const projectId = jobToProject.get(row.scan_job_id);
      if (!projectId || !row.business_id) continue;
      const key = `${projectId}:${row.business_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bucket = byProject[projectId] || emptyDetailProgress();
      byProject[projectId] = bucket;
      bucket.total += 1;
      const st = row.businesses?.detail_status || "pending";
      if (st === "completed") bucket.completed += 1;
      else if (st === "failed") bucket.failed += 1;
      else if (st === "claimed" || st === "running") bucket.active += 1;
      else bucket.pending += 1;
    }
    if (rows.length < page) break;
    from += page;
  }
  return byProject;
}

/**
 * Proje başına tekil işletme detay ilerlemesi.
 * Sayım veritabanında yapılır; sonuç satırları tarayıcıya inmez.
 * Dönen map: projectId -> { total, completed, failed, pending, active }
 */
export async function fetchDetailProgressByProject(supabase, projects = []) {
  const byProject = {};
  for (const p of projects) byProject[p.id] = emptyDetailProgress();
  const ids = projects.map((p) => p.id).filter(Boolean);
  if (!ids.length) return byProject;

  const { data, error } = await supabase.rpc("get_projects_detail_progress", {
    p_project_ids: ids,
  });
  if (error) {
    if (progressRpcMissing(error)) {
      return fetchDetailProgressLegacy(supabase, projects, byProject);
    }
    throw error;
  }
  for (const row of data || []) {
    byProject[row.project_id] = {
      total: Number(row.total) || 0,
      completed: Number(row.completed) || 0,
      failed: Number(row.failed) || 0,
      pending: Number(row.pending) || 0,
      active: Number(row.active) || 0,
    };
  }
  return byProject;
}

export async function listProjects(supabase) {
  const projects = unwrap(
    await supabase
      .from("projects")
      .select(
        "id, name, keyword, location, status, created_at, updated_at, scan_jobs(id, scan_type, status, total_tasks, completed_tasks, failed_tasks, businesses_found)",
      )
      .order("created_at", { ascending: false }),
  );
  const detailByProject = await fetchDetailProgressByProject(supabase, projects);
  return projects.map((p) => ({
    ...p,
    progress: summarizeProjectProgress(p, detailByProject[p.id]),
  }));
}

export async function createProject(
  supabase,
  { name, keyword, location, searchTerms },
) {
  const data = unwrap(
    await supabase.rpc("create_project_with_tasks", {
      p_name: name,
      p_keyword: keyword,
      p_location: location,
      p_search_terms: searchTerms,
    }),
  );
  return data;
}

export async function getProject(supabase, id) {
  const { data, error } = await supabase
    .from("projects")
    .select("*, scan_jobs(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** İlk görevin alındığı an. Proje kaydından ayrı, taramaya başlama zamanı. */
export async function getProjectFirstScan(supabase, jobIds) {
  if (!jobIds.length) return null;
  const { data, error } = await supabase
    .from("scan_tasks")
    .select("claimed_at")
    .in("scan_job_id", jobIds)
    .not("claimed_at", "is", null)
    .order("claimed_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.claimed_at || null;
}

/**
 * Proje durumunu değiştirir (active / paused / cancelled).
 * paused/cancelled: o projenin claimed/running işleri geri bırakılır,
 * ilgili worker'lara release_task gider; worker'lar başka aktif projelerden iş alabilir.
 */
export async function updateProjectStatus(supabase, id, status) {
  const data = unwrap(
    await supabase.rpc("admin_set_project_status", {
      p_project_id: id,
      p_status: status,
    }),
  );
  return data?.project || data;
}

export async function pauseProject(supabase, id) {
  return updateProjectStatus(supabase, id, "paused");
}

export async function resumeProject(supabase, id) {
  return updateProjectStatus(supabase, id, "active");
}

/**
 * Projedeki başarısız liste görevleri + detay işletmelerini tekrar kuyruğa alır.
 * Proje completed ise yeniden active olur.
 */
export async function retryProjectFailures(supabase, id) {
  return unwrap(
    await supabase.rpc("admin_retry_project_failures", {
      p_project_id: id,
    }),
  );
}

/** Projenin liste taramalarını bekleyen kuyruğa geri alır. Detay durumuna dokunmaz. */
export async function requeueProjectList(supabase, id) {
  return unwrap(
    await supabase.rpc("admin_requeue_project_list", {
      p_project_id: id,
    }),
  );
}

/** Proje görevleri (arama terimleri), sayfalı. */
export async function getProjectTasks(
  supabase,
  jobIds,
  { status = "all", search = "", page = 0, pageSize = PAGE_SIZE } = {},
) {
  if (!jobIds.length) return { rows: [], count: 0 };
  let q = supabase
    .from("scan_tasks")
    .select(
      "id, task_type, search_term, status, attempt_count, result_count, last_error, completed_at, created_at, workers(name)",
      { count: "exact" },
    )
    .in("scan_job_id", jobIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (status !== "all") q = q.eq("status", status);
  if (search.trim()) q = q.ilike("search_term", `%${sanitizeLike(search)}%`);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

function localDayBound(dateStr, nextDay) {
  const [year, month, day] = String(dateStr || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day + (nextDay ? 1 : 0)).toISOString();
}

function applyPresence(query, column, mode) {
  if (mode === "yes") return query.not(column, "is", null).neq(column, "");
  if (mode === "no") return query.or(`${column}.is.null,${column}.eq.`);
  return query;
}

/** Projeye ait işletmeler (tekil), sayfalı. */
export async function getProjectBusinesses(
  supabase,
  jobIds,
  {
    search = "",
    page = 0,
    pageSize = PAGE_SIZE,
    from = "",
    to = "",
    phone = "all",
    website = "all",
    detail = "all",
  } = {},
) {
  if (!jobIds.length) return { rows: [], count: 0 };
  let q = supabase
    .from("businesses")
    .select(
      "id, place_id, name, city, district, phone, website, rating, review_count, detail_status, created_at, scan_results!inner(search_term, scan_job_id)",
      { count: "exact" },
    )
    .in("scan_results.scan_job_id", jobIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (search.trim()) {
    const s = sanitizeLike(search);
    q = q.or(`name.ilike.%${s}%,place_id.ilike.%${s}%,district.ilike.%${s}%`);
  }

  const fromIso = localDayBound(from, false);
  const toIso = localDayBound(to, true);
  if (fromIso) q = q.gte("created_at", fromIso);
  if (toIso) q = q.lt("created_at", toIso);
  q = applyPresence(q, "phone", phone);
  q = applyPresence(q, "website", website);
  if (detail && detail !== "all") q = q.eq("detail_status", detail);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function getProjectErrors(supabase, jobIds, limit = 50) {
  if (!jobIds.length) return [];
  return unwrap(
    await supabase
      .from("scrape_errors")
      .select(
        "id, error_type, message, created_at, workers(name), scan_tasks(search_term)",
      )
      .in("scan_job_id", jobIds)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

/** Görev durumlarına göre sayılar. */
export async function getProjectTaskCounts(supabase, jobIds) {
  const statuses = ["pending", "claimed", "running", "completed", "failed"];
  const result = {};
  await Promise.all(
    statuses.map(async (s) => {
      if (!jobIds.length) {
        result[s] = 0;
        return;
      }
      const { count, error } = await supabase
        .from("scan_tasks")
        .select("id", { count: "exact", head: true })
        .in("scan_job_id", jobIds)
        .eq("status", s);
      if (error) throw error;
      result[s] = count || 0;
    }),
  );
  return result;
}

/**
 * CSV dışa aktarma için projedeki tüm işletmeleri 1000'lik parçalarla çeker.
 * Her satırda arama terimleri `search_terms` dizisi olarak gelir.
 */
export async function fetchAllProjectBusinesses(
  supabase,
  jobIds,
  { onProgress, signal } = {},
) {
  const batch = 1000;
  const all = [];
  let from = 0;
  for (;;) {
    if (signal?.aborted) throw new Error("İptal edildi");
    const { data, error } = await supabase
      .from("businesses")
      .select("*, scan_results!inner(search_term, scan_job_id)")
      .in("scan_results.scan_job_id", jobIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + batch - 1);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    onProgress?.(all.length);
    if (rows.length < batch) break;
    from += batch;
  }
  return all;
}

// PostgREST or()/ilike içinde sorun çıkaran karakterleri temizler.
export function sanitizeLike(value) {
  return String(value)
    .replace(/[%,()*\\]/g, " ")
    .trim();
}
