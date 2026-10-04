-- Raise lease window for DETAIL batches and extend leases on heartbeat.
UPDATE public.app_config SET value = '900'::jsonb, updated_at = now() WHERE key = 'lease_seconds';

CREATE OR REPLACE FUNCTION public.register_worker(p_worker_key text, p_name text DEFAULT NULL, p_extension_version text DEFAULT NULL)
RETURNS public.workers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.workers;
BEGIN
  IF p_worker_key IS NULL OR length(trim(p_worker_key)) < 8 THEN RAISE EXCEPTION 'invalid_worker_key'; END IF;
  INSERT INTO public.workers (worker_key, name, status, extension_version, last_heartbeat_at, started_at)
  VALUES (trim(p_worker_key), COALESCE(NULLIF(trim(p_name), ''), 'Worker-' || left(trim(p_worker_key), 8)), 'idle', p_extension_version, now(), now())
  ON CONFLICT (worker_key) DO UPDATE SET
    name = CASE
      WHEN NULLIF(trim(EXCLUDED.name), '') IS NOT NULL AND EXCLUDED.name NOT LIKE 'Worker-%' THEN EXCLUDED.name
      ELSE public.workers.name
    END,
    extension_version = COALESCE(EXCLUDED.extension_version, public.workers.extension_version),
    last_heartbeat_at = now(),
    status = CASE WHEN public.workers.status = 'offline' THEN 'idle' ELSE public.workers.status END,
    updated_at = now()
  RETURNING * INTO w;
  RETURN w;
END; $$;

CREATE OR REPLACE FUNCTION public.worker_heartbeat(p_worker_key text, p_status text DEFAULT NULL, p_auto_mode boolean DEFAULT NULL, p_current_task_type text DEFAULT NULL, p_current_task_id uuid DEFAULT NULL, p_current_job_id uuid DEFAULT NULL, p_current_search_term text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.workers; v_lease integer := public.config_int('lease_seconds', 900);
BEGIN
  w := public.get_worker_by_key(p_worker_key);
  UPDATE public.workers SET last_heartbeat_at = now(), status = COALESCE(NULLIF(p_status, ''), status), auto_mode = COALESCE(p_auto_mode, auto_mode), current_task_type = p_current_task_type, current_task_id = p_current_task_id, current_job_id = p_current_job_id, current_search_term = p_current_search_term, updated_at = now()
  WHERE id = w.id RETURNING * INTO w;

  IF w.current_task_id IS NOT NULL THEN
    UPDATE public.scan_tasks SET lease_expires_at = now() + make_interval(secs => v_lease), updated_at = now()
    WHERE id = w.current_task_id AND worker_id = w.id AND status IN ('claimed', 'running');
  END IF;

  IF w.current_task_type = 'detail' THEN
    UPDATE public.businesses SET detail_lease_expires_at = now() + make_interval(secs => v_lease), updated_at = now()
    WHERE detail_worker_id = w.id AND detail_status = 'claimed';
  END IF;

  RETURN jsonb_build_object('worker', to_jsonb(w), 'requested_action', w.requested_action, 'requested_action_at', w.requested_action_at);
END; $$;
