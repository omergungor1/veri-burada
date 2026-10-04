-- Sorun: Liste bitince proje 'completed' oluyor; claim yalnızca active projelerden
-- detay aldığı için bekleyen detaylar (ör. 148) worker'lara verilmiyordu.
--
-- Düzeltmeler:
-- 1) Proje, liste + detay (pending/claimed) bitmeden completed olmaz
-- 2) claim_next_work paused/cancelled dışındaki projelerden detay alır
-- 3) Bekleyen detayı olan completed projeler yeniden active yapılır

CREATE OR REPLACE FUNCTION public.maybe_complete_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_jobs integer;
  v_open_detail integer;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN;
  END IF;

  -- Manuel paused/cancelled dokunma
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND status IN ('paused', 'cancelled')
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_open_jobs
  FROM public.scan_jobs j
  WHERE j.project_id = p_project_id
    AND j.status IN ('pending', 'running');

  SELECT count(*) INTO v_open_detail
  FROM public.businesses b
  WHERE b.detail_status IN ('pending', 'claimed')
    AND EXISTS (
      SELECT 1
      FROM public.scan_results sr
      JOIN public.scan_jobs j ON j.id = sr.scan_job_id
      WHERE sr.business_id = b.id
        AND j.project_id = p_project_id
    );

  IF v_open_jobs = 0 AND v_open_detail = 0 THEN
    UPDATE public.projects SET
      status = 'completed',
      updated_at = now()
    WHERE id = p_project_id
      AND status <> 'completed';
  ELSE
    -- Hâlâ iş varken completed kalmışsa tekrar active yap
    UPDATE public.projects SET
      status = 'active',
      updated_at = now()
    WHERE id = p_project_id
      AND status = 'completed';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_list_results(
  p_worker_key text,
  p_task_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
  v_task public.scan_tasks;
  v_job public.scan_jobs;
  v_item jsonb;
  v_place_id text;
  v_business_id uuid;
  v_linked integer := 0;
  v_unique_map jsonb := '{}'::jsonb;
BEGIN
  w := public.get_worker_by_key(p_worker_key);

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task.id IS NULL THEN RAISE EXCEPTION 'task_not_found'; END IF;
  IF v_task.worker_id IS DISTINCT FROM w.id THEN RAISE EXCEPTION 'task_not_owned'; END IF;
  IF v_task.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'linked', 0);
  END IF;

  SELECT * INTO v_job FROM public.scan_jobs WHERE id = v_task.scan_job_id FOR UPDATE;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb))
  LOOP
    v_place_id := nullif(trim(COALESCE(v_item->>'place_id', '')), '');
    IF v_place_id IS NULL OR v_unique_map ? v_place_id THEN CONTINUE; END IF;
    v_unique_map := v_unique_map || jsonb_build_object(v_place_id, true);

    INSERT INTO public.businesses AS b (
      place_id, cid, name, city, district, lat, lng, rating, review_count,
      google_maps_url, detail_status
    )
    VALUES (
      v_place_id,
      nullif(v_item->>'cid', ''),
      nullif(v_item->>'name', ''),
      nullif(v_item->>'city', ''),
      nullif(v_item->>'district', ''),
      NULLIF(v_item->>'lat', '')::double precision,
      NULLIF(v_item->>'lng', '')::double precision,
      NULLIF(v_item->>'rating', '')::double precision,
      NULLIF(v_item->>'review_count', '')::integer,
      nullif(v_item->>'google_maps_url', ''),
      'pending'
    )
    ON CONFLICT (place_id) DO UPDATE SET
      cid = COALESCE(EXCLUDED.cid, b.cid),
      name = COALESCE(EXCLUDED.name, b.name),
      city = COALESCE(EXCLUDED.city, b.city),
      district = COALESCE(EXCLUDED.district, b.district),
      lat = COALESCE(EXCLUDED.lat, b.lat),
      lng = COALESCE(EXCLUDED.lng, b.lng),
      rating = COALESCE(EXCLUDED.rating, b.rating),
      review_count = COALESCE(EXCLUDED.review_count, b.review_count),
      google_maps_url = COALESCE(EXCLUDED.google_maps_url, b.google_maps_url),
      updated_at = now()
    RETURNING id INTO v_business_id;

    INSERT INTO public.scan_results (scan_job_id, scan_task_id, business_id, place_id, search_term)
    VALUES (v_task.scan_job_id, v_task.id, v_business_id, v_place_id, v_task.search_term)
    ON CONFLICT (scan_task_id, business_id) DO NOTHING;
  END LOOP;

  SELECT count(*) INTO v_linked FROM public.scan_results WHERE scan_task_id = v_task.id;

  UPDATE public.scan_tasks SET
    status = 'completed',
    completed_at = now(),
    lease_expires_at = NULL,
    result_count = v_linked,
    updated_at = now()
  WHERE id = v_task.id;

  UPDATE public.scan_jobs SET
    completed_tasks = completed_tasks + 1,
    businesses_found = businesses_found + v_linked,
    status = CASE
      WHEN completed_tasks + 1 + failed_tasks >= total_tasks THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN completed_tasks + 1 + failed_tasks >= total_tasks THEN now()
      ELSE completed_at
    END
  WHERE id = v_job.id;

  -- Liste bitince hemen completed yapma; detay da bitsin
  PERFORM public.maybe_complete_project(v_job.project_id);

  UPDATE public.workers SET
    processed_list_tasks = processed_list_tasks + 1,
    status = 'idle',
    current_task_type = NULL,
    current_task_id = NULL,
    current_job_id = NULL,
    current_search_term = NULL,
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object('ok', true, 'linked', v_linked);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_detail_results(
  p_worker_key text,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
  v_item jsonb;
  v_place_id text;
  v_ok integer := 0;
  v_fail integer := 0;
  v_max integer := public.config_int('max_attempts', 5);
  v_project_id uuid;
BEGIN
  w := public.get_worker_by_key(p_worker_key);

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb))
  LOOP
    v_place_id := nullif(trim(COALESCE(v_item->>'place_id', '')), '');
    IF v_place_id IS NULL THEN CONTINUE; END IF;

    IF COALESCE((v_item->>'ok')::boolean, false) THEN
      UPDATE public.businesses b SET
        cid = COALESCE(nullif(v_item->>'cid', ''), b.cid),
        name = COALESCE(nullif(v_item->>'name', ''), b.name),
        city = COALESCE(nullif(v_item->>'city', ''), b.city),
        district = COALESCE(nullif(v_item->>'district', ''), b.district),
        full_address = COALESCE(nullif(v_item->>'full_address', ''), b.full_address),
        plus_code = COALESCE(nullif(v_item->>'plus_code', ''), b.plus_code),
        phone = COALESCE(nullif(v_item->>'phone', ''), b.phone),
        website = COALESCE(nullif(v_item->>'website', ''), b.website),
        lat = COALESCE(NULLIF(v_item->>'lat', '')::double precision, b.lat),
        lng = COALESCE(NULLIF(v_item->>'lng', '')::double precision, b.lng),
        rating = COALESCE(NULLIF(v_item->>'rating', '')::double precision, b.rating),
        review_count = COALESCE(NULLIF(v_item->>'review_count', '')::integer, b.review_count),
        business_type = COALESCE(nullif(v_item->>'business_type', ''), b.business_type),
        image_url = COALESCE(nullif(v_item->>'image_url', ''), b.image_url),
        working_hours = COALESCE(nullif(v_item->>'working_hours', ''), b.working_hours),
        google_maps_url = COALESCE(nullif(v_item->>'google_maps_url', ''), b.google_maps_url),
        detail_status = 'completed',
        detailed_at = now(),
        detail_worker_id = NULL,
        detail_claimed_at = NULL,
        detail_lease_expires_at = NULL,
        detail_last_error = NULL,
        updated_at = now()
      WHERE b.place_id = v_place_id
        AND b.detail_worker_id = w.id;

      IF FOUND THEN v_ok := v_ok + 1; END IF;
    ELSE
      UPDATE public.businesses b SET
        detail_status = CASE WHEN b.detail_attempt_count >= v_max THEN 'failed' ELSE 'pending' END,
        detail_worker_id = NULL,
        detail_claimed_at = NULL,
        detail_lease_expires_at = NULL,
        detail_last_error = COALESCE(v_item->>'error', 'detail_failed'),
        updated_at = now()
      WHERE b.place_id = v_place_id
        AND b.detail_worker_id = w.id;

      IF FOUND THEN
        v_fail := v_fail + 1;
        INSERT INTO public.scrape_errors (worker_id, business_id, error_type, message, context)
        SELECT w.id, b.id, 'detail', COALESCE(v_item->>'error', 'detail_failed'), v_item
        FROM public.businesses b WHERE b.place_id = v_place_id;
      END IF;
    END IF;
  END LOOP;

  -- Bu worker'ın dokunduğu işletmelerin projelerini kontrol et
  FOR v_project_id IN
    SELECT DISTINCT j.project_id
    FROM public.scan_results sr
    JOIN public.scan_jobs j ON j.id = sr.scan_job_id
    JOIN public.businesses b ON b.id = sr.business_id
    WHERE b.place_id IN (
      SELECT nullif(trim(COALESCE(x->>'place_id', '')), '')
      FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb)) x
    )
  LOOP
    PERFORM public.maybe_complete_project(v_project_id);
  END LOOP;

  UPDATE public.workers SET
    processed_detail_businesses = processed_detail_businesses + v_ok,
    failed_tasks = failed_tasks + v_fail,
    status = 'idle',
    current_task_type = NULL,
    current_task_id = NULL,
    current_job_id = NULL,
    current_search_term = NULL,
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object('ok', true, 'success', v_ok, 'failed', v_fail);
END;
$$;

-- claim: paused/cancelled hariç (completed ama detayı kalan projeler de çalışsın)
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
        AND p.status NOT IN ('paused', 'cancelled')
    );

  SELECT count(*) INTO v_pending_list
  FROM public.scan_tasks t
  JOIN public.scan_jobs j ON j.id = t.scan_job_id
  JOIN public.projects p ON p.id = j.project_id
  WHERE t.task_type = 'list'
    AND t.status = 'pending'
    AND p.status NOT IN ('paused', 'cancelled');

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
            AND p.status NOT IN ('paused', 'cancelled')
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
      AND p.status NOT IN ('paused', 'cancelled')
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

      IF v_project.status IN ('paused', 'cancelled') THEN
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

        -- Liste işi geliyorsa completed görünmesin
        UPDATE public.projects SET
          status = 'active',
          updated_at = now()
        WHERE id = v_project.id
          AND status = 'completed';

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

-- Mevcut takılı projeleri düzelt
UPDATE public.projects p SET
  status = 'active',
  updated_at = now()
WHERE p.status = 'completed'
  AND EXISTS (
    SELECT 1
    FROM public.scan_jobs j
    JOIN public.scan_results sr ON sr.scan_job_id = j.id
    JOIN public.businesses b ON b.id = sr.business_id
    WHERE j.project_id = p.id
      AND b.detail_status IN ('pending', 'claimed')
  );

REVOKE ALL ON FUNCTION public.maybe_complete_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maybe_complete_project(uuid) TO authenticated, service_role;
