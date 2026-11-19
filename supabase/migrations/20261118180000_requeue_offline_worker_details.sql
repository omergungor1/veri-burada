-- Offline worker'ın elindeki iş bekletilmez.
-- Heartbeat süresi dolmuşsa claimed detaylar ve liste görevleri pending'e döner.
-- claim_next_work bu fonksiyonu başta çağırır; boştaki aktif eklenti aynı turda işi alır.

CREATE OR REPLACE FUNCTION public.requeue_expired_work()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts integer := public.config_int('max_attempts', 5);
  v_online integer := public.config_int('heartbeat_online_seconds', 90);
  v_list_count integer := 0;
  v_detail_count integer := 0;
  v_list_offline integer := 0;
  v_detail_offline integer := 0;
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

  -- Sekme kapanınca lease (15 dk) dolmasını bekleme.
  -- Son heartbeat online süresinden eskiyse işi bırak.
  UPDATE public.scan_tasks t SET
    status = CASE WHEN t.attempt_count >= v_max_attempts THEN 'failed' ELSE 'pending' END,
    worker_id = NULL,
    claimed_at = NULL,
    started_at = NULL,
    lease_expires_at = NULL,
    last_error = CASE
      WHEN t.attempt_count >= v_max_attempts THEN COALESCE(t.last_error, 'max_attempts_exceeded')
      ELSE 'worker_offline'
    END,
    completed_at = CASE WHEN t.attempt_count >= v_max_attempts THEN now() ELSE NULL END,
    updated_at = now()
  FROM public.workers w
  WHERE t.worker_id = w.id
    AND t.task_type = 'list'
    AND t.status IN ('claimed', 'running')
    AND (
      w.last_heartbeat_at IS NULL
      OR w.last_heartbeat_at < now() - make_interval(secs => v_online)
    );

  GET DIAGNOSTICS v_list_offline = ROW_COUNT;

  UPDATE public.businesses b SET
    detail_status = CASE WHEN b.detail_attempt_count >= v_max_attempts THEN 'failed' ELSE 'pending' END,
    detail_worker_id = NULL,
    detail_claimed_at = NULL,
    detail_lease_expires_at = NULL,
    detail_last_error = CASE
      WHEN b.detail_attempt_count >= v_max_attempts THEN COALESCE(b.detail_last_error, 'max_attempts_exceeded')
      ELSE 'worker_offline'
    END,
    updated_at = now()
  FROM public.workers w
  WHERE b.detail_worker_id = w.id
    AND b.detail_status = 'claimed'
    AND (
      w.last_heartbeat_at IS NULL
      OR w.last_heartbeat_at < now() - make_interval(secs => v_online)
    );

  GET DIAGNOSTICS v_detail_offline = ROW_COUNT;

  UPDATE public.workers w SET
    status = CASE WHEN w.status = 'paused' THEN w.status ELSE 'offline' END,
    current_task_type = NULL,
    current_task_id = NULL,
    current_job_id = NULL,
    current_search_term = NULL,
    updated_at = now()
  WHERE (
      w.last_heartbeat_at IS NULL
      OR w.last_heartbeat_at < now() - make_interval(secs => v_online)
    )
    AND (
      w.status NOT IN ('offline', 'paused')
      OR w.current_task_type IS NOT NULL
      OR w.current_task_id IS NOT NULL
      OR w.current_job_id IS NOT NULL
    );

  RETURN jsonb_build_object(
    'requeued_list_tasks', v_list_count + v_list_offline,
    'requeued_detail_businesses', v_detail_count + v_detail_offline,
    'requeued_offline_list_tasks', v_list_offline,
    'requeued_offline_detail_businesses', v_detail_offline
  );
END;
$$;
