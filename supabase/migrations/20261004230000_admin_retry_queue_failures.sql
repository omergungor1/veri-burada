-- Kuyruk "Başarısız" sekmesinden tüm failed liste/detay kayıtlarını tekrar kuyruğa alır.

CREATE OR REPLACE FUNCTION public.admin_retry_queue_failures(p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_retried integer := 0;
  v_detail_retried integer := 0;
  v_projects_activated integer := 0;
  v_job_ids uuid[];
  v_project_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('list', 'detail') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  IF p_kind = 'list' THEN
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
      WHERE t.status = 'failed'
      RETURNING t.scan_job_id
    )
    SELECT count(*), coalesce(array_agg(DISTINCT scan_job_id), ARRAY[]::uuid[])
    INTO v_list_retried, v_job_ids
    FROM upd;

    IF v_list_retried > 0 THEN
      UPDATE public.scan_jobs j SET
        failed_tasks = (
          SELECT count(*)::integer FROM public.scan_tasks t
          WHERE t.scan_job_id = j.id AND t.status = 'failed'
        ),
        completed_tasks = (
          SELECT count(*)::integer FROM public.scan_tasks t
          WHERE t.scan_job_id = j.id AND t.status = 'completed'
        ),
        status = CASE
          WHEN EXISTS (
            SELECT 1 FROM public.scan_tasks t
            WHERE t.scan_job_id = j.id AND t.status IN ('pending', 'claimed', 'running')
          ) THEN 'running'
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

      SELECT coalesce(array_agg(DISTINCT j.project_id), ARRAY[]::uuid[])
      INTO v_project_ids
      FROM public.scan_jobs j
      WHERE j.id = ANY (v_job_ids);

      WITH act AS (
        UPDATE public.projects p SET
          status = 'active',
          updated_at = now()
        WHERE p.id = ANY (v_project_ids)
          AND p.status IN ('completed', 'paused')
        RETURNING 1
      )
      SELECT count(*) INTO v_projects_activated FROM act;
    END IF;

  ELSE
    WITH upd AS (
      UPDATE public.businesses b SET
        detail_status = 'pending',
        detail_worker_id = NULL,
        detail_claimed_at = NULL,
        detail_lease_expires_at = NULL,
        detail_attempt_count = 0,
        detail_last_error = NULL,
        next_detail_scan_at = NULL,
        updated_at = now()
      WHERE b.detail_status = 'failed'
      RETURNING b.id
    ),
    proj AS (
      SELECT DISTINCT j.project_id
      FROM upd
      JOIN public.scan_results sr ON sr.business_id = upd.id
      JOIN public.scan_jobs j ON j.id = sr.scan_job_id
    ),
    act AS (
      UPDATE public.projects p SET
        status = 'active',
        updated_at = now()
      FROM proj
      WHERE p.id = proj.project_id
        AND p.status IN ('completed', 'paused')
      RETURNING 1
    )
    SELECT
      (SELECT count(*) FROM upd),
      (SELECT count(*) FROM act)
    INTO v_detail_retried, v_projects_activated;
  END IF;

  RETURN jsonb_build_object(
    'kind', p_kind,
    'list_retried', v_list_retried,
    'detail_retried', v_detail_retried,
    'projects_activated', v_projects_activated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retry_queue_failures(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_queue_failures(text) TO authenticated, service_role;
