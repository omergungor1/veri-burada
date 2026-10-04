-- Proje başarısız liste görevleri + detay işletmelerini tekrar kuyruğa alır.

CREATE OR REPLACE FUNCTION public.admin_retry_project_failures(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_job_ids uuid[];
  v_list_retried integer := 0;
  v_detail_retried integer := 0;
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
  WHERE j.project_id = p_project_id;

  IF coalesce(array_length(v_job_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'project', to_jsonb(v_project),
      'list_retried', 0,
      'detail_retried', 0
    );
  END IF;

  -- Başarısız liste görevlerini tekrar pending yap
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
      updated_at = now()
    WHERE t.scan_job_id = ANY (v_job_ids)
      AND t.status = 'failed'
    RETURNING 1
  )
  SELECT count(*) INTO v_list_retried FROM upd;

  -- Job sayaçlarını gerçek durumdan yeniden hesapla; completed job'ları yeniden aç
  UPDATE public.scan_jobs j SET
    failed_tasks = (
      SELECT count(*)::integer
      FROM public.scan_tasks t
      WHERE t.scan_job_id = j.id AND t.status = 'failed'
    ),
    completed_tasks = (
      SELECT count(*)::integer
      FROM public.scan_tasks t
      WHERE t.scan_job_id = j.id AND t.status = 'completed'
    ),
    status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.scan_tasks t
        WHERE t.scan_job_id = j.id AND t.status IN ('pending', 'claimed', 'running')
      ) THEN 'running'
      WHEN EXISTS (
        SELECT 1 FROM public.scan_tasks t
        WHERE t.scan_job_id = j.id AND t.status = 'failed'
      ) THEN 'failed'
      ELSE j.status
    END,
    completed_at = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.scan_tasks t
        WHERE t.scan_job_id = j.id AND t.status IN ('pending', 'claimed', 'running')
      ) THEN NULL
      ELSE j.completed_at
    END
  WHERE j.id = ANY (v_job_ids);

  -- Başarısız detay işletmelerini tekrar pending yap
  WITH biz AS (
    SELECT DISTINCT sr.business_id AS id
    FROM public.scan_results sr
    WHERE sr.scan_job_id = ANY (v_job_ids)
  ),
  upd AS (
    UPDATE public.businesses b SET
      detail_status = 'pending',
      detail_worker_id = NULL,
      detail_claimed_at = NULL,
      detail_lease_expires_at = NULL,
      detail_attempt_count = 0,
      detail_last_error = NULL,
      next_detail_scan_at = NULL,
      updated_at = now()
    FROM biz
    WHERE b.id = biz.id
      AND b.detail_status = 'failed'
    RETURNING 1
  )
  SELECT count(*) INTO v_detail_retried FROM upd;

  IF v_list_retried = 0 AND v_detail_retried = 0 THEN
    RETURN jsonb_build_object(
      'project', to_jsonb(v_project),
      'list_retried', 0,
      'detail_retried', 0,
      'message', 'no_failures'
    );
  END IF;

  -- Proje tekrar aktif olsun (completed/paused ise)
  UPDATE public.projects SET
    status = 'active',
    updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_project;

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'list_retried', v_list_retried,
    'detail_retried', v_detail_retried
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retry_project_failures(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_project_failures(uuid) TO authenticated, service_role;
