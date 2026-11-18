-- Proje detay ilerlemesini tek sorguda sayar.
-- Tarayıcı scan_results satırlarını sayfa sayfa indirmez.

CREATE OR REPLACE FUNCTION public.get_projects_detail_progress(p_project_ids uuid[])
RETURNS TABLE (
  project_id uuid,
  total bigint,
  completed bigint,
  failed bigint,
  pending bigint,
  active bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN QUERY
  SELECT
    sj.project_id,
    COUNT(DISTINCT sr.business_id) AS total,
    COUNT(DISTINCT sr.business_id) FILTER (
      WHERE b.detail_status = 'completed'
    ) AS completed,
    COUNT(DISTINCT sr.business_id) FILTER (
      WHERE b.detail_status = 'failed'
    ) AS failed,
    COUNT(DISTINCT sr.business_id) FILTER (
      WHERE COALESCE(b.detail_status, 'pending') NOT IN ('completed', 'failed', 'claimed', 'running')
    ) AS pending,
    COUNT(DISTINCT sr.business_id) FILTER (
      WHERE b.detail_status IN ('claimed', 'running')
    ) AS active
  FROM public.scan_results sr
  JOIN public.scan_jobs sj ON sj.id = sr.scan_job_id
  LEFT JOIN public.businesses b ON b.id = sr.business_id
  WHERE sr.business_id IS NOT NULL
    AND sj.project_id = ANY(COALESCE(p_project_ids, '{}'))
  GROUP BY sj.project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_projects_detail_progress(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_projects_detail_progress(uuid[]) TO authenticated;
