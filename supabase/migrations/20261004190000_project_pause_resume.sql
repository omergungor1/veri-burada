-- Proje Durdur / Devam Et:
-- 1) claim_next_work yalnızca active projelerden iş alır
-- 2) admin_set_project_status: pause'da o projenin claimed/running işlerini geri bırakır,
--    ilgili worker'lara release_task gönderir; resume'da tekrar claim edilebilir

CREATE OR REPLACE FUNCTION public.claim_next_work(p_worker_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
  v_lease integer := public.config_int('lease_seconds', 180);
  v_threshold integer := public.config_int('detail_threshold', 100);
  v_batch integer := public.config_int('detail_batch_size', 100);
  v_pending_detail integer;
  v_pending_list integer;
  v_task public.scan_tasks;
  v_job public.scan_jobs;
  v_project public.projects;
  v_ids uuid[];
  v_businesses jsonb;
BEGIN
  w := public.get_worker_by_key(p_worker_key);

  IF w.status = 'paused' OR COALESCE(w.auto_mode, false) = false THEN
    RETURN jsonb_build_object('type', 'idle', 'reason', 'paused_or_stopped');
  END IF;

  PERFORM public.requeue_expired_work();

  -- Yalnızca active projelere bağlı işletmeler
  SELECT count(*) INTO v_pending_detail
  FROM public.businesses b
  WHERE (
      b.detail_status = 'pending'
      OR (
        b.detail_status = 'completed'
        AND b.next_detail_scan_at IS NOT NULL
        AND b.next_detail_scan_at <= now()
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.scan_results sr
      JOIN public.scan_jobs j ON j.id = sr.scan_job_id
      JOIN public.projects p ON p.id = j.project_id
      WHERE sr.business_id = b.id
        AND p.status = 'active'
    );

  SELECT count(*) INTO v_pending_list
  FROM public.scan_tasks t
  JOIN public.scan_jobs j ON j.id = t.scan_job_id
  JOIN public.projects p ON p.id = j.project_id
  WHERE t.task_type = 'list'
    AND t.status = 'pending'
    AND p.status = 'active';

  IF v_pending_detail >= v_threshold
     OR (v_pending_list = 0 AND v_pending_detail > 0) THEN

    WITH cte AS (
      SELECT b.id
      FROM public.businesses b
      WHERE (
          b.detail_status = 'pending'
          OR (
            b.detail_status = 'completed'
            AND b.next_detail_scan_at IS NOT NULL
            AND b.next_detail_scan_at <= now()
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.scan_results sr
          JOIN public.scan_jobs j ON j.id = sr.scan_job_id
          JOIN public.projects p ON p.id = j.project_id
          WHERE sr.business_id = b.id
            AND p.status = 'active'
        )
      ORDER BY b.created_at ASC
      FOR UPDATE OF b SKIP LOCKED
      LIMIT v_batch
    ),
    upd AS (
      UPDATE public.businesses b SET
        detail_status = 'claimed',
        detail_worker_id = w.id,
        detail_claimed_at = now(),
        detail_lease_expires_at = now() + make_interval(secs => v_lease),
        detail_attempt_count = b.detail_attempt_count + 1,
        updated_at = now()
      FROM cte
      WHERE b.id = cte.id
      RETURNING b.id, b.place_id, b.cid, b.name, b.created_at
    )
    SELECT
      coalesce(array_agg(upd.id), ARRAY[]::uuid[]),
      coalesce(jsonb_agg(jsonb_build_object(
        'id', upd.id,
        'place_id', upd.place_id,
        'cid', upd.cid,
        'name', upd.name
      ) ORDER BY upd.created_at), '[]'::jsonb)
    INTO v_ids, v_businesses
    FROM upd;

    IF coalesce(array_length(v_ids, 1), 0) > 0 THEN
      UPDATE public.workers SET
        status = 'working',
        current_task_type = 'detail',
        current_task_id = NULL,
        current_job_id = NULL,
        current_search_term = NULL,
        last_heartbeat_at = now(),
        updated_at = now()
      WHERE id = w.id;

      RETURN jsonb_build_object(
        'type', 'detail',
        'batch_size', jsonb_array_length(v_businesses),
        'businesses', v_businesses
      );
    END IF;
  END IF;

  IF v_pending_list > 0 THEN
    SELECT t.* INTO v_task
    FROM public.scan_tasks t
    JOIN public.scan_jobs j ON j.id = t.scan_job_id
    JOIN public.projects p ON p.id = j.project_id
    WHERE t.task_type = 'list'
      AND t.status = 'pending'
      AND p.status = 'active'
    ORDER BY t.created_at ASC
    FOR UPDATE OF t SKIP LOCKED
    LIMIT 1;

    IF v_task.id IS NOT NULL THEN
      UPDATE public.scan_tasks SET
        status = 'running',
        worker_id = w.id,
        claimed_at = now(),
        started_at = now(),
        lease_expires_at = now() + make_interval(secs => v_lease),
        attempt_count = attempt_count + 1,
        updated_at = now()
      WHERE id = v_task.id
      RETURNING * INTO v_task;

      SELECT * INTO v_job FROM public.scan_jobs WHERE id = v_task.scan_job_id;
      SELECT * INTO v_project FROM public.projects WHERE id = v_job.project_id;

      -- Pause ile yarış: claim sonrası proje artık active değilse geri bırak
      IF v_project.status IS DISTINCT FROM 'active' THEN
        UPDATE public.scan_tasks SET
          status = 'pending',
          worker_id = NULL,
          claimed_at = NULL,
          started_at = NULL,
          lease_expires_at = NULL,
          updated_at = now()
        WHERE id = v_task.id;
      ELSE
        IF v_job.status = 'pending' THEN
          UPDATE public.scan_jobs SET
            status = 'running',
            started_at = COALESCE(started_at, now())
          WHERE id = v_job.id;
        END IF;

        UPDATE public.workers SET
          status = 'working',
          current_task_type = 'list',
          current_task_id = v_task.id,
          current_job_id = v_job.id,
          current_search_term = v_task.search_term,
          last_heartbeat_at = now(),
          updated_at = now()
        WHERE id = w.id;

        RETURN jsonb_build_object(
          'type', 'list',
          'task', to_jsonb(v_task),
          'job', to_jsonb(v_job),
          'project', to_jsonb(v_project)
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.workers SET
    status = 'idle',
    current_task_type = NULL,
    current_task_id = NULL,
    current_job_id = NULL,
    current_search_term = NULL,
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object('type', 'idle', 'reason', 'no_work');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_project_status(
  p_project_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_job_ids uuid[];
  v_list_released integer := 0;
  v_detail_released integer := 0;
  v_workers_notified integer := 0;
  v_target_workers uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('active', 'paused', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  IF v_project.status = 'completed' AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'project_already_completed';
  END IF;

  UPDATE public.projects SET
    status = p_status,
    updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_project;

  SELECT coalesce(array_agg(j.id), ARRAY[]::uuid[])
  INTO v_job_ids
  FROM public.scan_jobs j
  WHERE j.project_id = p_project_id;

  IF p_status IN ('paused', 'cancelled') AND coalesce(array_length(v_job_ids, 1), 0) > 0 THEN
    -- Önce ilgili worker'ları topla (release sonrası bağlar kopmasın)
    SELECT coalesce(array_agg(DISTINCT wid), ARRAY[]::uuid[])
    INTO v_target_workers
    FROM (
      SELECT w.id AS wid
      FROM public.workers w
      WHERE w.current_job_id = ANY (v_job_ids)

      UNION

      SELECT t.worker_id
      FROM public.scan_tasks t
      WHERE t.scan_job_id = ANY (v_job_ids)
        AND t.status IN ('claimed', 'running')
        AND t.worker_id IS NOT NULL

      UNION

      SELECT b.detail_worker_id
      FROM public.businesses b
      JOIN public.scan_results sr ON sr.business_id = b.id
      WHERE sr.scan_job_id = ANY (v_job_ids)
        AND b.detail_status = 'claimed'
        AND b.detail_worker_id IS NOT NULL
    ) x;

    WITH upd AS (
      UPDATE public.scan_tasks t SET
        status = 'pending',
        worker_id = NULL,
        claimed_at = NULL,
        started_at = NULL,
        lease_expires_at = NULL,
        updated_at = now()
      WHERE t.scan_job_id = ANY (v_job_ids)
        AND t.status IN ('claimed', 'running')
      RETURNING 1
    )
    SELECT count(*) INTO v_list_released FROM upd;

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
        updated_at = now()
      FROM biz
      WHERE b.id = biz.id
        AND b.detail_status = 'claimed'
      RETURNING 1
    )
    SELECT count(*) INTO v_detail_released FROM upd;

    IF coalesce(array_length(v_target_workers, 1), 0) > 0 THEN
      WITH upd AS (
        UPDATE public.workers w SET
          requested_action = 'release_task',
          requested_action_at = now(),
          current_task_type = NULL,
          current_task_id = NULL,
          current_job_id = NULL,
          current_search_term = NULL,
          status = CASE WHEN w.auto_mode THEN 'idle' ELSE w.status END,
          updated_at = now()
        WHERE w.id = ANY (v_target_workers)
        RETURNING w.id
      )
      SELECT count(*) INTO v_workers_notified FROM upd;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'list_released', v_list_released,
    'detail_released', v_detail_released,
    'workers_notified', v_workers_notified
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_project_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_project_status(uuid, text) TO authenticated, service_role;
