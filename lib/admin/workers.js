// İşçi (worker) servisleri.
// Kartta yalnızca duruma uygun, sadeleştirilmiş aksiyonlar gösterilir.

export const WORKER_ACTIONS = [
  { key: "pause", label: "Duraklat", icon: "pause", tone: "default" },
  { key: "resume", label: "Devam", icon: "play", tone: "primary" },
  { key: "start_auto", label: "Otomatik aç", icon: "play", tone: "primary" },
  { key: "stop_auto", label: "Otomatik kapat", icon: "stop", tone: "default", confirm: true },
  { key: "release_task", label: "Görevi bırak", icon: "unlock", tone: "default", confirm: true },
  { key: "reset", label: "Sıfırla", icon: "reset", tone: "danger", confirm: true },
];

/** Worker kartında gösterilecek aksiyonlar (pause/resume ve auto tek toggle). */
export function getVisibleWorkerActions(worker, status) {
  const byKey = Object.fromEntries(WORKER_ACTIONS.map((a) => [a.key, a]));
  const actions = [];

  if (status !== "offline") {
    actions.push(status === "paused" ? byKey.resume : byKey.pause);
  }

  actions.push(worker.auto_mode ? byKey.stop_auto : byKey.start_auto);

  if (worker.current_task_type || worker.current_task_id) {
    actions.push(byKey.release_task);
  }

  actions.push(byKey.reset);
  return actions.filter(Boolean);
}

export async function getOnlineSeconds(supabase) {
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "heartbeat_online_seconds")
    .maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export function isWorkerOnline(worker, onlineSeconds = 90, now = Date.now()) {
  if (!worker?.last_heartbeat_at) return false;
  return now - new Date(worker.last_heartbeat_at).getTime() < onlineSeconds * 1000;
}

/** Heartbeat'e göre efektif durum: bayatsa offline. */
export function effectiveStatus(worker, onlineSeconds = 90, now = Date.now()) {
  if (!isWorkerOnline(worker, onlineSeconds, now)) return "offline";
  return worker.status;
}

export async function listWorkers(supabase) {
  const [onlineSeconds, workersRes] = await Promise.all([
    getOnlineSeconds(supabase),
    supabase
      .from("workers")
      .select("*")
      .order("last_heartbeat_at", { ascending: false, nullsFirst: false }),
  ]);
  if (workersRes.error) throw workersRes.error;
  return { workers: workersRes.data || [], onlineSeconds };
}

export function summarizeWorkers(workers, onlineSeconds) {
  const now = Date.now();
  const summary = {
    total: workers.length,
    online: 0,
    working: 0,
    idle: 0,
    paused: 0,
    offline: 0,
  };
  for (const w of workers) {
    const st = effectiveStatus(w, onlineSeconds, now);
    if (st === "offline") {
      summary.offline += 1;
      continue;
    }
    summary.online += 1;
    if (st === "working") summary.working += 1;
    else if (st === "paused") summary.paused += 1;
    else summary.idle += 1;
  }
  return summary;
}

export async function setWorkerAction(supabase, workerId, action) {
  const { data, error } = await supabase.rpc("admin_set_worker_action", {
    p_worker_id: workerId,
    p_action: action,
  });
  if (error) throw error;
  return data;
}
