// Dashboard servisleri. Tüm fonksiyonlar bir Supabase istemcisi alır.
import {
  fetchDetailProgressByProject,
  summarizeProjectProgress,
} from "@/lib/admin/projects";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function getDashboardStats(supabase) {
  return unwrap(await supabase.rpc("get_dashboard_stats"));
}

export async function getRecentProjects(supabase, limit = 6) {
  const projects = unwrap(
    await supabase
      .from("projects")
      .select(
        "id, name, keyword, location, status, created_at, scan_jobs(id, total_tasks, completed_tasks, failed_tasks, businesses_found)",
      )
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  const detailByProject = await fetchDetailProgressByProject(supabase, projects);
  return projects.map((p) => ({
    ...p,
    progress: summarizeProjectProgress(p, detailByProject[p.id]),
  }));
}

export async function getRecentErrors(supabase, limit = 8) {
  return unwrap(
    await supabase
      .from("scrape_errors")
      .select(
        "id, error_type, message, created_at, workers(name, worker_key), scan_tasks(search_term)",
      )
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

export async function loadDashboard(supabase) {
  const [stats, projects, errors] = await Promise.all([
    getDashboardStats(supabase),
    getRecentProjects(supabase),
    getRecentErrors(supabase),
  ]);
  return { stats, projects, errors };
}
