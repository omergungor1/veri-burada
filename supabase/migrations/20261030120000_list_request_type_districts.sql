ALTER TABLE public.list_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'region_list',
  ADD COLUMN IF NOT EXISTS districts text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.list_requests
  DROP CONSTRAINT IF EXISTS list_requests_request_type_check;

ALTER TABLE public.list_requests
  ADD CONSTRAINT list_requests_request_type_check
  CHECK (request_type IN ('region_list', 'new_openings'));

DROP FUNCTION IF EXISTS public.create_list_request(text, text[], text[], boolean);

CREATE OR REPLACE FUNCTION public.create_list_request(
  p_title text,
  p_keywords text[],
  p_cities text[],
  p_all_turkey boolean DEFAULT false,
  p_request_type text DEFAULT 'region_list',
  p_districts text[] DEFAULT '{}'
)
RETURNS public.list_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keywords text[];
  v_cities text[];
  v_districts text[];
  v_title text;
  v_type text;
  v_active integer;
  v_row public.list_requests;
BEGIN
  PERFORM public.ensure_my_profile();
  PERFORM pg_advisory_xact_lock(hashtext('list-limit:' || auth.uid()::text));

  v_type := COALESCE(NULLIF(btrim(p_request_type), ''), 'region_list');
  IF v_type NOT IN ('region_list', 'new_openings') THEN
    RAISE EXCEPTION 'Geçersiz liste türü.';
  END IF;

  v_keywords := public._normalize_keywords(p_keywords);
  IF coalesce(array_length(v_keywords, 1), 0) < 1 THEN
    RAISE EXCEPTION 'En az bir arama terimi zorunludur.';
  END IF;
  IF array_length(v_keywords, 1) > 10 THEN
    RAISE EXCEPTION 'En fazla 10 arama terimi ekleyebilirsin.';
  END IF;

  v_cities := public._normalize_keywords(p_cities);
  IF NOT COALESCE(p_all_turkey, false) AND coalesce(array_length(v_cities, 1), 0) < 1 THEN
    RAISE EXCEPTION 'En az bir il seçmelisin.';
  END IF;
  IF COALESCE(p_all_turkey, false) AND coalesce(array_length(v_cities, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Tüm Türkiye seçildiğinde il listesi boş olamaz.';
  END IF;

  v_districts := public._normalize_keywords(COALESCE(p_districts, '{}'));

  v_title := NULLIF(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Liste adı zorunludur.';
  END IF;

  SELECT count(*) INTO v_active
  FROM public.list_requests
  WHERE user_id = auth.uid()
    AND status IN ('queued', 'processing');

  IF v_active >= 3 THEN
    RAISE EXCEPTION 'Aynı anda en fazla 3 liste talebi oluşturabilirsin. Yeni bir talep için mevcut listelerinden birinin tamamlanmasını beklemelisin.';
  END IF;

  INSERT INTO public.list_requests (
    user_id, title, keywords, cities, all_turkey, request_type, districts, status
  )
  VALUES (
    auth.uid(), v_title, v_keywords, v_cities, COALESCE(p_all_turkey, false),
    v_type, v_districts, 'queued'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_list_request(text, text[], text[], boolean, text, text[]) TO authenticated;
