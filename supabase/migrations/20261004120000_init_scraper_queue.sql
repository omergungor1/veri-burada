-- Google Maps Scraper Management System
-- Atomic queue, workers, businesses, RLS

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  keyword text NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scan_type text NOT NULL
    CHECK (scan_type IN ('list', 'detail', 'max_detail')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_tasks integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  failed_tasks integer NOT NULL DEFAULT 0,
  businesses_found integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key text NOT NULL UNIQUE,
  name text,
  status text NOT NULL DEFAULT 'offline'
    CHECK (status IN ('offline', 'idle', 'working', 'paused', 'stopping', 'error')),
  auto_mode boolean NOT NULL DEFAULT false,
  current_task_type text,
  current_task_id uuid,
  current_job_id uuid,
  current_search_term text,
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  extension_version text,
  processed_list_tasks integer NOT NULL DEFAULT 0,
  processed_detail_businesses integer NOT NULL DEFAULT 0,
  failed_tasks integer NOT NULL DEFAULT 0,
  requested_action text
    CHECK (requested_action IS NULL OR requested_action IN (
      'pause', 'resume', 'stop_auto', 'start_auto', 'release_task', 'reset'
    )),
  requested_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_job_id uuid NOT NULL REFERENCES public.scan_jobs(id) ON DELETE CASCADE,
  task_type text NOT NULL
    CHECK (task_type IN ('list', 'detail', 'max_detail')),
  search_term text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'running', 'completed', 'failed', 'cancelled')),
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  lease_expires_at timestamptz,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text NOT NULL UNIQUE,
  cid text,
  name text,
  city text,
  district text,
  full_address text,
  plus_code text,
  phone text,
  website text,
  lat double precision,
  lng double precision,
  rating double precision,
  review_count integer,
  business_type text,
  image_url text,
  working_hours text,
  google_maps_url text,
  detail_status text NOT NULL DEFAULT 'pending'
    CHECK (detail_status IN ('pending', 'claimed', 'completed', 'failed')),
  detail_worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  detail_claimed_at timestamptz,
  detail_lease_expires_at timestamptz,
  detail_attempt_count integer NOT NULL DEFAULT 0,
  detail_last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  detailed_at timestamptz,
  max_detailed_at timestamptz,
  next_detail_scan_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_job_id uuid NOT NULL REFERENCES public.scan_jobs(id) ON DELETE CASCADE,
  scan_task_id uuid NOT NULL REFERENCES public.scan_tasks(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  search_term text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_task_id, business_id)
);

CREATE TABLE public.scrape_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  scan_job_id uuid REFERENCES public.scan_jobs(id) ON DELETE SET NULL,
  scan_task_id uuid REFERENCES public.scan_tasks(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  error_type text,
  message text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_config (key, value) VALUES
  ('detail_threshold', '100'::jsonb),
  ('detail_batch_size', '50'::jsonb),
  ('lease_seconds', '180'::jsonb),
  ('max_attempts', '5'::jsonb),
  ('heartbeat_online_seconds', '90'::jsonb);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_scan_jobs_project_id ON public.scan_jobs(project_id);
CREATE INDEX idx_scan_jobs_type_status ON public.scan_jobs(scan_type, status);

CREATE INDEX idx_scan_tasks_status ON public.scan_tasks(status);
CREATE INDEX idx_scan_tasks_job_status ON public.scan_tasks(scan_job_id, status);
CREATE INDEX idx_scan_tasks_worker_id ON public.scan_tasks(worker_id);
CREATE INDEX idx_scan_tasks_lease ON public.scan_tasks(lease_expires_at)
  WHERE status IN ('claimed', 'running');

CREATE INDEX idx_businesses_cid ON public.businesses(cid);
CREATE INDEX idx_businesses_detail_status ON public.businesses(detail_status);
CREATE INDEX idx_businesses_next_detail ON public.businesses(next_detail_scan_at)
  WHERE next_detail_scan_at IS NOT NULL;
CREATE INDEX idx_businesses_detail_lease ON public.businesses(detail_lease_expires_at)
  WHERE detail_status = 'claimed';

CREATE INDEX idx_scan_results_job ON public.scan_results(scan_job_id);
CREATE INDEX idx_scan_results_task ON public.scan_results(scan_task_id);
CREATE INDEX idx_scan_results_business ON public.scan_results(business_id);
CREATE INDEX idx_scan_results_place ON public.scan_results(place_id);

CREATE INDEX idx_workers_heartbeat ON public.workers(last_heartbeat_at);
CREATE INDEX idx_workers_status ON public.workers(status);

CREATE INDEX idx_scrape_errors_created ON public.scrape_errors(created_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_scan_tasks_updated BEFORE UPDATE ON public.scan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_workers_updated BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.config_int(p_key text, p_default integer)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::integer FROM public.app_config WHERE key = p_key),
    p_default
  );
$$;

CREATE OR REPLACE FUNCTION public.get_worker_by_key(p_worker_key text)
RETURNS public.workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
BEGIN
  SELECT * INTO w FROM public.workers WHERE worker_key = p_worker_key;
  IF w.id IS NULL THEN
    RAISE EXCEPTION 'unknown_worker';
  END IF;
  RETURN w;
END;
$$;

-- ---------------------------------------------------------------------------
-- Project creation (admin / authenticated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_project_with_tasks(
  p_name text,
  p_keyword text,
  p_location text,
  p_search_terms text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_job public.scan_jobs;
  v_terms text[];
  v_term text;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT trim(t)
    FROM unnest(COALESCE(p_search_terms, ARRAY[]::text[])) AS t
    WHERE trim(t) <> ''
  ) INTO v_terms;

  IF coalesce(array_length(v_terms, 1), 0) = 0 THEN
    RAISE EXCEPTION 'no_search_terms';
  END IF;

  INSERT INTO public.projects (name, keyword, location, status)
  VALUES (trim(p_name), trim(p_keyword), trim(p_location), 'active')
  RETURNING * INTO v_project;

  INSERT INTO public.scan_jobs (project_id, scan_type, status, total_tasks, started_at)
  VALUES (v_project.id, 'list', 'running', array_length(v_terms, 1), now())
  RETURNING * INTO v_job;

  FOREACH v_term IN ARRAY v_terms LOOP
    INSERT INTO public.scan_tasks (scan_job_id, task_type, search_term, status)
    VALUES (v_job.id, 'list', v_term, 'pending');
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'scan_job', to_jsonb(v_job),
    'task_count', v_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Worker register / heartbeat
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_worker(
  p_worker_key text,
  p_name text DEFAULT NULL,
  p_extension_version text DEFAULT NULL
)
RETURNS public.workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
BEGIN
  IF p_worker_key IS NULL OR length(trim(p_worker_key)) < 8 THEN
    RAISE EXCEPTION 'invalid_worker_key';
  END IF;

  INSERT INTO public.workers (worker_key, name, status, extension_version, last_heartbeat_at, started_at)
  VALUES (
    trim(p_worker_key),
    COALESCE(NULLIF(trim(p_name), ''), 'Worker-' || left(trim(p_worker_key), 8)),
    'idle',
    p_extension_version,
    now(),
    now()
  )
  ON CONFLICT (worker_key) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.workers.name),
    extension_version = COALESCE(EXCLUDED.extension_version, public.workers.extension_version),
    last_heartbeat_at = now(),
    status = CASE
      WHEN public.workers.status = 'offline' THEN 'idle'
      ELSE public.workers.status
    END,
    updated_at = now()
  RETURNING * INTO w;

  RETURN w;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_heartbeat(
  p_worker_key text,
  p_status text DEFAULT NULL,
  p_auto_mode boolean DEFAULT NULL,
  p_current_task_type text DEFAULT NULL,
  p_current_task_id uuid DEFAULT NULL,
  p_current_job_id uuid DEFAULT NULL,
  p_current_search_term text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
BEGIN
  w := public.get_worker_by_key(p_worker_key);

  UPDATE public.workers SET
    last_heartbeat_at = now(),
    status = COALESCE(NULLIF(p_status, ''), status),
    auto_mode = COALESCE(p_auto_mode, auto_mode),
    current_task_type = p_current_task_type,
    current_task_id = p_current_task_id,
    current_job_id = p_current_job_id,
    current_search_term = p_current_search_term,
    updated_at = now()
  WHERE id = w.id
  RETURNING * INTO w;

  RETURN jsonb_build_object(
    'worker', to_jsonb(w),
    'requested_action', w.requested_action,
    'requested_action_at', w.requested_action_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_worker_action(p_worker_key text)
RETURNS public.workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
BEGIN
  w := public.get_worker_by_key(p_worker_key);
  UPDATE public.workers SET
    requested_action = NULL,
    requested_action_at = NULL,
    updated_at = now()
  WHERE id = w.id
  RETURNING * INTO w;
  RETURN w;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_worker_action(
  p_worker_id uuid,
  p_action text
)
RETURNS public.workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.workers SET
    requested_action = p_action,
    requested_action_at = now(),
    updated_at = now()
  WHERE id = p_worker_id
  RETURNING * INTO w;

  IF w.id IS NULL THEN
    RAISE EXCEPTION 'worker_not_found';
  END IF;
  RETURN w;
END;
$$;

-- ---------------------------------------------------------------------------
-- Requeue expired leases
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.requeue_expired_work()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts integer := public.config_int('max_attempts', 5);
  v_list_count integer := 0;
  v_detail_count integer := 0;
BEGIN
  UPDATE public.scan_tasks t SET
    status = CASE WHEN t.attempt_count >= v_max_attempts THEN 'failed' ELSE 'pending' END,
    worker_id = NULL,
    claimed_at = NULL,
    started_at = NULL,
    lease_expires_at = NULL,
    last_error = CASE
      WHEN t.attempt_count >= v_max_attempts THEN COALESCE(t.last_error, 'max_attempts_exceeded')
      ELSE COALESCE(t.last_error, 'lease_expired')
    END,
    completed_at = CASE WHEN t.attempt_count >= v_max_attempts THEN now() ELSE NULL END,
    updated_at = now()
  WHERE t.task_type = 'list'
    AND t.status IN ('claimed', 'running')
    AND t.lease_expires_at IS NOT NULL
    AND t.lease_expires_at < now();

  GET DIAGNOSTICS v_list_count = ROW_COUNT;

  UPDATE public.businesses b SET
    detail_status = CASE WHEN b.detail_attempt_count >= v_max_attempts THEN 'failed' ELSE 'pending' END,
    detail_worker_id = NULL,
    detail_claimed_at = NULL,
    detail_lease_expires_at = NULL,
    detail_last_error = CASE
      WHEN b.detail_attempt_count >= v_max_attempts THEN COALESCE(b.detail_last_error, 'max_attempts_exceeded')
      ELSE COALESCE(b.detail_last_error, 'lease_expired')
    END,
    updated_at = now()
  WHERE b.detail_status = 'claimed'
    AND b.detail_lease_expires_at IS NOT NULL
    AND b.detail_lease_expires_at < now();

  GET DIAGNOSTICS v_detail_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'requeued_list_tasks', v_list_count,
    'requeued_detail_businesses', v_detail_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim next work (LIST / DETAIL priority)
-- ---------------------------------------------------------------------------

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
  WHERE b.detail_status = 'pending'
     OR (b.detail_status = 'completed' AND b.next_detail_scan_at IS NOT NULL AND b.next_detail_scan_at <= now());

  SELECT count(*) INTO v_pending_list
  FROM public.scan_tasks t
  WHERE t.task_type = 'list' AND t.status = 'pending';

  IF v_pending_detail >= v_threshold
     OR (v_pending_list = 0 AND v_pending_detail > 0) THEN

    WITH cte AS (
      SELECT b.id
      FROM public.businesses b
      WHERE b.detail_status = 'pending'
         OR (b.detail_status = 'completed' AND b.next_detail_scan_at IS NOT NULL AND b.next_detail_scan_at <= now())
      ORDER BY b.created_at ASC
      FOR UPDATE SKIP LOCKED
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
    WHERE t.task_type = 'list' AND t.status = 'pending'
    ORDER BY t.created_at ASC
    FOR UPDATE SKIP LOCKED
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

      IF v_job.status = 'pending' THEN
        UPDATE public.scan_jobs SET status = 'running', started_at = COALESCE(started_at, now())
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

-- ---------------------------------------------------------------------------
-- Submit LIST results (atomic)
-- ---------------------------------------------------------------------------

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
  v_inserted integer := 0;
  v_linked integer := 0;
  v_unique_map jsonb := '{}'::jsonb;
BEGIN
  w := public.get_worker_by_key(p_worker_key);

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task_not_found';
  END IF;
  IF v_task.worker_id IS DISTINCT FROM w.id THEN
    RAISE EXCEPTION 'task_not_owned';
  END IF;
  IF v_task.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'inserted', 0, 'linked', 0);
  END IF;

  SELECT * INTO v_job FROM public.scan_jobs WHERE id = v_task.scan_job_id FOR UPDATE;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb))
  LOOP
    v_place_id := nullif(trim(COALESCE(v_item->>'place_id', '')), '');
    IF v_place_id IS NULL THEN
      CONTINUE;
    END IF;
    IF v_unique_map ? v_place_id THEN
      CONTINUE;
    END IF;
    v_unique_map := v_unique_map || jsonb_build_object(v_place_id, true);

    INSERT INTO public.businesses AS b (
      place_id, cid, name, city, district, lat, lng, rating, review_count,
      google_maps_url, detail_status
    ) VALUES (
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

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    INSERT INTO public.scan_results (scan_job_id, scan_task_id, business_id, place_id, search_term)
    VALUES (v_task.scan_job_id, v_task.id, v_business_id, v_place_id, v_task.search_term)
    ON CONFLICT (scan_task_id, business_id) DO NOTHING;

    IF FOUND THEN
      v_linked := v_linked + 1;
    END IF;
  END LOOP;

  -- recount linked for accuracy
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

  UPDATE public.projects p SET
    status = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.scan_jobs j
        WHERE j.project_id = p.id AND j.status IN ('pending', 'running')
      ) THEN 'completed'
      ELSE p.status
    END,
    updated_at = now()
  WHERE p.id = v_job.project_id;

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

  RETURN jsonb_build_object(
    'ok', true,
    'linked', v_linked,
    'unique_places', (SELECT count(*) FROM jsonb_object_keys(v_unique_map))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_list_task(
  p_worker_key text,
  p_task_id uuid,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
  v_task public.scan_tasks;
  v_max integer := public.config_int('max_attempts', 5);
BEGIN
  w := public.get_worker_by_key(p_worker_key);
  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task.id IS NULL OR v_task.worker_id IS DISTINCT FROM w.id THEN
    RAISE EXCEPTION 'task_not_owned';
  END IF;

  IF v_task.attempt_count >= v_max THEN
    UPDATE public.scan_tasks SET
      status = 'failed',
      last_error = COALESCE(p_error, last_error),
      completed_at = now(),
      lease_expires_at = NULL,
      updated_at = now()
    WHERE id = v_task.id;

    UPDATE public.scan_jobs SET failed_tasks = failed_tasks + 1 WHERE id = v_task.scan_job_id;
  ELSE
    UPDATE public.scan_tasks SET
      status = 'pending',
      worker_id = NULL,
      claimed_at = NULL,
      started_at = NULL,
      lease_expires_at = NULL,
      last_error = COALESCE(p_error, last_error),
      updated_at = now()
    WHERE id = v_task.id;
  END IF;

  INSERT INTO public.scrape_errors (worker_id, scan_job_id, scan_task_id, error_type, message)
  VALUES (w.id, v_task.scan_job_id, v_task.id, 'list_task', COALESCE(p_error, 'unknown'));

  UPDATE public.workers SET
    failed_tasks = failed_tasks + 1,
    status = 'idle',
    current_task_type = NULL,
    current_task_id = NULL,
    current_job_id = NULL,
    current_search_term = NULL,
    updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Submit DETAIL results (partial success)
-- ---------------------------------------------------------------------------

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
BEGIN
  w := public.get_worker_by_key(p_worker_key);

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb))
  LOOP
    v_place_id := nullif(trim(COALESCE(v_item->>'place_id', '')), '');
    IF v_place_id IS NULL THEN
      CONTINUE;
    END IF;

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

      IF FOUND THEN
        v_ok := v_ok + 1;
      END IF;
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

CREATE OR REPLACE FUNCTION public.release_worker_task(p_worker_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workers;
BEGIN
  w := public.get_worker_by_key(p_worker_key);

  UPDATE public.scan_tasks SET
    status = 'pending',
    worker_id = NULL,
    claimed_at = NULL,
    started_at = NULL,
    lease_expires_at = NULL,
    updated_at = now()
  WHERE worker_id = w.id AND status IN ('claimed', 'running');

  UPDATE public.businesses SET
    detail_status = 'pending',
    detail_worker_id = NULL,
    detail_claimed_at = NULL,
    detail_lease_expires_at = NULL,
    updated_at = now()
  WHERE detail_worker_id = w.id AND detail_status = 'claimed';

  UPDATE public.workers SET
    status = 'idle',
    current_task_type = NULL,
    current_task_id = NULL,
    current_job_id = NULL,
    current_search_term = NULL,
    updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_online_secs integer := public.config_int('heartbeat_online_seconds', 90);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN jsonb_build_object(
    'active_projects', (SELECT count(*) FROM public.projects WHERE status = 'active'),
    'pending_list_tasks', (SELECT count(*) FROM public.scan_tasks WHERE task_type = 'list' AND status = 'pending'),
    'pending_detail_businesses', (SELECT count(*) FROM public.businesses WHERE detail_status = 'pending'),
    'total_businesses', (SELECT count(*) FROM public.businesses),
    'online_workers', (
      SELECT count(*) FROM public.workers
      WHERE last_heartbeat_at IS NOT NULL
        AND last_heartbeat_at > now() - make_interval(secs => v_online_secs)
    ),
    'working_workers', (
      SELECT count(*) FROM public.workers
      WHERE status = 'working'
        AND last_heartbeat_at IS NOT NULL
        AND last_heartbeat_at > now() - make_interval(secs => v_online_secs)
    ),
    'idle_workers', (
      SELECT count(*) FROM public.workers
      WHERE status = 'idle'
        AND last_heartbeat_at IS NOT NULL
        AND last_heartbeat_at > now() - make_interval(secs => v_online_secs)
    ),
    'paused_workers', (
      SELECT count(*) FROM public.workers
      WHERE status = 'paused'
        AND last_heartbeat_at IS NOT NULL
        AND last_heartbeat_at > now() - make_interval(secs => v_online_secs)
    ),
    'offline_workers', (
      SELECT count(*) FROM public.workers
      WHERE last_heartbeat_at IS NULL
         OR last_heartbeat_at <= now() - make_interval(secs => v_online_secs)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_projects ON public.projects FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_scan_jobs ON public.scan_jobs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_scan_tasks ON public.scan_tasks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_businesses ON public.businesses FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_scan_results ON public.scan_results FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_workers ON public.workers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_scrape_errors ON public.scrape_errors FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY admin_read_app_config ON public.app_config FOR SELECT TO authenticated
  USING (true);

-- Anon has no direct table access; workers use SECURITY DEFINER RPCs only.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_worker(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_heartbeat(text, text, boolean, text, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_worker_action(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_work(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_list_results(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_list_task(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_detail_results(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_worker_task(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_expired_work() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_with_tasks(text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_worker_action(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
