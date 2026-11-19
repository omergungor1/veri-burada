-- Projenin liste taramalarını yeniden bekleyen kuyruğa alır.
-- İşletme detay durumu değişmez: submit_list_results yeni place_id için
-- detail_status = pending yazar, mevcut satırda detail_status'a dokunmaz.
-- Böylece daha önce detayı alınmış işletmeler tekrar detay kuyruğuna girmez.

CREATE OR REPLACE FUNCTION public.admin_requeue_project_list(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_job_ids uuid[];
  v_list_requeued integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  IF v_project.status = 'cancelled' THEN
    RAISE EXCEPTION 'project_cancelled';
  END IF;

  SELECT coalesce(array_agg(j.id), ARRAY[]::uuid[])
  INTO v_job_ids
  FROM public.scan_jobs j
  WHERE j.project_id = p_project_id
    AND j.scan_type = 'list';

  IF coalesce(array_length(v_job_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'project', to_jsonb(v_project),
      'list_requeued', 0
    );
  END IF;

  WITH upd AS (
    UPDATE public.scan_tasks t SET
      status = 'pending',
      worker_id = NULL,
      claimed_at = NULL,
      started_at = NULL,
      completed_at = NULL,
      lease_expires_at = NULL,
      attempt_count = 0,
      last_error = NULL,
      result_count = 0,
      updated_at = now()
    WHERE t.scan_job_id = ANY (v_job_ids)
      AND t.task_type = 'list'
      AND t.status <> 'pending'
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_list_requeued FROM upd;

  UPDATE public.scan_jobs j SET
    completed_tasks = (
      SELECT count(*)::integer
      FROM public.scan_tasks t
      WHERE t.scan_job_id = j.id AND t.status = 'completed'
    ),
    failed_tasks = (
      SELECT count(*)::integer
      FROM public.scan_tasks t
      WHERE t.scan_job_id = j.id AND t.status = 'failed'
    ),
    businesses_found = (
      SELECT coalesce(sum(t.result_count), 0)::integer
      FROM public.scan_tasks t
      WHERE t.scan_job_id = j.id AND t.status = 'completed'
    ),
    status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.scan_tasks t
        WHERE t.scan_job_id = j.id
          AND t.status IN ('pending', 'claimed', 'running')
      ) THEN 'running'
      ELSE j.status
    END,
    completed_at = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.scan_tasks t
        WHERE t.scan_job_id = j.id
          AND t.status IN ('pending', 'claimed', 'running')
      ) THEN NULL
      ELSE j.completed_at
    END
  WHERE j.id = ANY (v_job_ids);

  IF v_list_requeued > 0 THEN
    UPDATE public.projects SET
      status = 'active',
      updated_at = now()
    WHERE id = p_project_id
      AND status IS DISTINCT FROM 'cancelled'
    RETURNING * INTO v_project;
  END IF;

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'list_requeued', v_list_requeued
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_requeue_project_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_requeue_project_list(uuid) TO authenticated, service_role;
