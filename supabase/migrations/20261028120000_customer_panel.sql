-- Müşteri paneli: profiller, liste talepleri, kredi cüzdanı, RLS ve RPC.
-- Mevcut tarama kuyruğu tablolarını silmez; admin erişimini is_platform_admin() ile sıkılaştırır.

-- ---------------------------------------------------------------------------
-- Admin allowlist + is_platform_admin
-- ---------------------------------------------------------------------------

INSERT INTO public.app_config (key, value)
VALUES ('admin_emails', '["omergungorco@gmail.com"]'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.jwt_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  role text NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  usage_purposes text[] NOT NULL DEFAULT '{}',
  user_type text,
  monthly_data_need text,
  target_business_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  marketing_email_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.list_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  all_turkey boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  business_count integer,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  ready_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.list_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.list_requests (id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses (id) ON DELETE SET NULL,
  place_id text,
  business_name text,
  phone text,
  website text,
  email text,
  address text,
  city text,
  district text,
  rating double precision,
  review_count integer,
  google_maps_url text,
  is_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, business_id)
);

CREATE TABLE public.list_statistics (
  list_id uuid PRIMARY KEY REFERENCES public.list_requests (id) ON DELETE CASCADE,
  unique_business_count integer NOT NULL DEFAULT 0,
  without_website_count integer NOT NULL DEFAULT 0,
  below_four_stars_count integer NOT NULL DEFAULT 0,
  with_phone_count integer NOT NULL DEFAULT 0,
  with_website_count integer NOT NULL DEFAULT 0,
  with_email_count integer NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_try numeric(12, 2) NOT NULL CHECK (price_try >= 0),
  shopier_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_wallets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  transaction_type text NOT NULL
    CHECK (transaction_type IN ('purchase', 'list_unlock', 'admin_adjustment', 'refund')),
  description text,
  list_id uuid REFERENCES public.list_requests (id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.credit_packages (id) ON DELETE SET NULL,
  admin_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  payment_reference text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.list_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.list_requests (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  credits_spent integer NOT NULL DEFAULT 0,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, user_id)
);

CREATE INDEX idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX idx_list_requests_user_status ON public.list_requests (user_id, status);
CREATE INDEX idx_list_requests_status ON public.list_requests (status, created_at DESC);
CREATE INDEX idx_list_businesses_list ON public.list_businesses (list_id, is_preview);
CREATE INDEX idx_credit_tx_user ON public.credit_transactions (user_id, created_at DESC);
CREATE UNIQUE INDEX idx_credit_tx_payment_ref
  ON public.credit_transactions (lower(btrim(payment_reference)))
  WHERE payment_reference IS NOT NULL AND length(btrim(payment_reference)) > 0;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.app_config c
        CROSS JOIN LATERAL jsonb_array_elements_text(c.value) AS e
        WHERE c.key = 'admin_emails'
          AND lower(trim(e)) = public.jwt_email()
      )
    );
$$;

INSERT INTO public.credit_packages
  (name, credits, price_try, shopier_url, is_active, is_popular, sort_order)
VALUES
  ('Başlangıç', 100, 200, NULL, true, false, 10),
  ('Popüler', 1000, 1200, NULL, true, true, 20),
  ('Profesyonel', 5000, 5000, NULL, true, false, 30),
  ('Kurumsal', 10000, 8000, NULL, true, false, 40);

-- ---------------------------------------------------------------------------
-- Auth + profile helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.provision_user_records(p_user_id uuid, p_email text, p_full_name text, p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'customer';
  v_email text := lower(trim(coalesce(p_email, '')));
  v_completed boolean := false;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.app_config c
    CROSS JOIN LATERAL jsonb_array_elements_text(c.value) AS e
    WHERE c.key = 'admin_emails'
      AND lower(trim(e)) = v_email
  ) THEN
    v_role := 'admin';
    v_completed := true;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, role, onboarding_completed, onboarding_step)
  VALUES (
    p_user_id,
    coalesce(p_full_name, ''),
    p_email,
    NULLIF(btrim(coalesce(p_phone, '')), ''),
    v_role,
    v_completed,
    CASE WHEN v_completed THEN 4 ELSE 1 END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = CASE
      WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = ''
        THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    role = CASE
      WHEN v_role = 'admin' THEN 'admin'
      ELSE public.profiles.role
    END,
    onboarding_completed = public.profiles.onboarding_completed OR v_completed,
    updated_at = now();

  INSERT INTO public.credit_wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_user_records(
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.raw_user_meta_data ->> 'phone'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email, updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_update();

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowlisted boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.app_config c
    CROSS JOIN LATERAL jsonb_array_elements_text(c.value) AS e
    WHERE c.key = 'admin_emails'
      AND lower(trim(e)) = public.jwt_email()
  ) INTO v_allowlisted;

  IF NOT coalesce(v_allowlisted, false) THEN
    NEW.role := OLD.role;
    NEW.email := OLD.email;
    IF OLD.onboarding_completed THEN
      NEW.onboarding_completed := true;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile ON public.profiles;
CREATE TRIGGER trg_protect_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_columns();

-- Mevcut auth kullanıcılarını geri doldur
INSERT INTO public.profiles (id, full_name, email, role, onboarding_completed, onboarding_step)
SELECT
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.email,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.app_config c
      CROSS JOIN LATERAL jsonb_array_elements_text(c.value) AS e
      WHERE c.key = 'admin_emails' AND lower(trim(e)) = lower(trim(coalesce(u.email, '')))
    ) THEN 'admin'
    ELSE 'customer'
  END,
  EXISTS (
    SELECT 1
    FROM public.app_config c
    CROSS JOIN LATERAL jsonb_array_elements_text(c.value) AS e
    WHERE c.key = 'admin_emails' AND lower(trim(e)) = lower(trim(coalesce(u.email, '')))
  ),
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.app_config c
      CROSS JOIN LATERAL jsonb_array_elements_text(c.value) AS e
      WHERE c.key = 'admin_emails' AND lower(trim(e)) = lower(trim(coalesce(u.email, '')))
    ) THEN 4
    ELSE 2
  END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.credit_wallets (user_id, balance)
SELECT id, 0 FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  PERFORM public.provision_user_records(
    v_user.id,
    v_user.email,
    coalesce(v_user.raw_user_meta_data ->> 'full_name', ''),
    v_user.raw_user_meta_data ->> 'phone'
  );

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_onboarding(
  p_step integer,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_usage_purposes text[] DEFAULT NULL,
  p_user_type text DEFAULT NULL,
  p_monthly_data_need text DEFAULT NULL,
  p_target_business_description text DEFAULT NULL,
  p_complete boolean DEFAULT false
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  PERFORM public.ensure_my_profile();

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(btrim(p_full_name), ''), full_name),
    phone = CASE WHEN p_phone IS NULL THEN phone ELSE NULLIF(btrim(p_phone), '') END,
    onboarding_step = GREATEST(onboarding_step, COALESCE(p_step, onboarding_step)),
    onboarding_completed = onboarding_completed OR p_complete,
    updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO public.onboarding_responses (
    user_id, usage_purposes, user_type, monthly_data_need, target_business_description
  )
  VALUES (
    auth.uid(),
    COALESCE(p_usage_purposes, '{}'),
    p_user_type,
    p_monthly_data_need,
    p_target_business_description
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    usage_purposes = COALESCE(p_usage_purposes, public.onboarding_responses.usage_purposes),
    user_type = COALESCE(p_user_type, public.onboarding_responses.user_type),
    monthly_data_need = COALESCE(p_monthly_data_need, public.onboarding_responses.monthly_data_need),
    target_business_description = COALESCE(p_target_business_description, public.onboarding_responses.target_business_description),
    updated_at = now();

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_profile(p_full_name text, p_phone text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;
  IF btrim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Ad soyad zorunludur.';
  END IF;

  UPDATE public.profiles
  SET
    full_name = btrim(p_full_name),
    phone = NULLIF(btrim(coalesce(p_phone, '')), ''),
    updated_at = now()
  WHERE id = auth.uid();

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_email_enabled boolean,
  p_sms_enabled boolean,
  p_whatsapp_enabled boolean,
  p_marketing_email_enabled boolean
)
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_preferences;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  INSERT INTO public.notification_preferences (
    user_id, email_enabled, sms_enabled, whatsapp_enabled, marketing_email_enabled
  )
  VALUES (
    auth.uid(),
    COALESCE(p_email_enabled, true),
    COALESCE(p_sms_enabled, false),
    COALESCE(p_whatsapp_enabled, false),
    COALESCE(p_marketing_email_enabled, false)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email_enabled = COALESCE(p_email_enabled, public.notification_preferences.email_enabled),
    sms_enabled = COALESCE(p_sms_enabled, public.notification_preferences.sms_enabled),
    whatsapp_enabled = COALESCE(p_whatsapp_enabled, public.notification_preferences.whatsapp_enabled),
    marketing_email_enabled = COALESCE(p_marketing_email_enabled, public.notification_preferences.marketing_email_enabled),
    updated_at = now();

  SELECT * INTO v_row FROM public.notification_preferences WHERE user_id = auth.uid();
  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- List request + preview/full/unlock
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._normalize_keywords(p_keywords text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_out text[] := '{}';
  v_seen text[] := '{}';
  v_raw text;
  v_val text;
  v_key text;
BEGIN
  FOREACH v_raw IN ARRAY COALESCE(p_keywords, '{}') LOOP
    v_val := btrim(regexp_replace(coalesce(v_raw, ''), '\s+', ' ', 'g'));
    IF v_val = '' THEN
      CONTINUE;
    END IF;
    v_key := lower(v_val);
    IF v_key = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := array_append(v_seen, v_key);
    v_out := array_append(v_out, v_val);
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_list_request(
  p_title text,
  p_keywords text[],
  p_cities text[],
  p_all_turkey boolean DEFAULT false
)
RETURNS public.list_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keywords text[];
  v_cities text[];
  v_title text;
  v_active integer;
  v_row public.list_requests;
BEGIN
  PERFORM public.ensure_my_profile();
  PERFORM pg_advisory_xact_lock(hashtext('list-limit:' || auth.uid()::text));

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

  INSERT INTO public.list_requests (user_id, title, keywords, cities, all_turkey, status)
  VALUES (auth.uid(), v_title, v_keywords, v_cities, COALESCE(p_all_turkey, false), 'queued')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_list_statistics(p_list_id uuid)
RETURNS public.list_statistics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats public.list_statistics;
  v_count integer;
  v_without integer := 0;
  v_below integer := 0;
  v_phone integer := 0;
  v_site integer := 0;
  v_email integer := 0;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE website IS NULL OR btrim(website) = ''),
    count(*) FILTER (WHERE rating IS NOT NULL AND rating < 4),
    count(*) FILTER (WHERE phone IS NOT NULL AND btrim(phone) <> ''),
    count(*) FILTER (WHERE website IS NOT NULL AND btrim(website) <> ''),
    count(*) FILTER (WHERE email IS NOT NULL AND btrim(email) <> '')
  INTO v_count, v_without, v_below, v_phone, v_site, v_email
  FROM public.list_businesses
  WHERE list_id = p_list_id;

  INSERT INTO public.list_statistics (
    list_id,
    unique_business_count,
    without_website_count,
    below_four_stars_count,
    with_phone_count,
    with_website_count,
    with_email_count,
    calculated_at
  )
  VALUES (
    p_list_id,
    COALESCE(v_count, 0),
    COALESCE(v_without, 0),
    COALESCE(v_below, 0),
    COALESCE(v_phone, 0),
    COALESCE(v_site, 0),
    COALESCE(v_email, 0),
    now()
  )
  ON CONFLICT (list_id) DO UPDATE
  SET
    unique_business_count = EXCLUDED.unique_business_count,
    without_website_count = EXCLUDED.without_website_count,
    below_four_stars_count = EXCLUDED.below_four_stars_count,
    with_phone_count = EXCLUDED.with_phone_count,
    with_website_count = EXCLUDED.with_website_count,
    with_email_count = EXCLUDED.with_email_count,
    calculated_at = now();

  UPDATE public.list_requests
  SET business_count = v_count, updated_at = now()
  WHERE id = p_list_id;

  UPDATE public.list_businesses SET is_preview = false WHERE list_id = p_list_id;
  UPDATE public.list_businesses
  SET is_preview = true
  WHERE id IN (
    SELECT id
    FROM public.list_businesses
    WHERE list_id = p_list_id
    ORDER BY business_name NULLS LAST, id
    LIMIT 10
  );

  SELECT * INTO v_stats FROM public.list_statistics WHERE list_id = p_list_id;
  RETURN v_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_list_request(
  p_list_id uuid,
  p_business_ids uuid[] DEFAULT NULL
)
RETURNS public.list_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.list_requests;
  v_ids uuid[];
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;

  SELECT * INTO v_list FROM public.list_requests WHERE id = p_list_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste talebi bulunamadı.';
  END IF;
  IF v_list.status = 'ready' THEN
    RETURN v_list;
  END IF;

  DELETE FROM public.list_businesses WHERE list_id = p_list_id;

  IF p_business_ids IS NOT NULL THEN
    v_ids := p_business_ids;
  ELSE
    SELECT coalesce(array_agg(b.id), '{}') INTO v_ids
    FROM public.businesses b
    WHERE (
        v_list.all_turkey
        OR EXISTS (
          SELECT 1
          FROM unnest(v_list.cities) AS city
          WHERE b.city ILIKE city
            OR coalesce(b.full_address, '') ILIKE '%' || city || '%'
        )
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(v_list.keywords) AS kw
        WHERE coalesce(b.name, '') ILIKE '%' || kw || '%'
          OR coalesce(b.business_type, '') ILIKE '%' || kw || '%'
      );
  END IF;

  INSERT INTO public.list_businesses (
    list_id, business_id, place_id, business_name, phone, website, email,
    address, city, district, rating, review_count, google_maps_url
  )
  SELECT
    p_list_id,
    b.id,
    b.place_id,
    b.name,
    b.phone,
    b.website,
    NULL,
    b.full_address,
    b.city,
    b.district,
    b.rating,
    b.review_count,
    b.google_maps_url
  FROM public.businesses b
  WHERE b.id = ANY (COALESCE(v_ids, '{}'))
  ON CONFLICT (list_id, business_id) DO NOTHING;

  PERFORM public.recompute_list_statistics(p_list_id);

  UPDATE public.list_requests
  SET
    status = 'ready',
    started_at = COALESCE(started_at, now()),
    completed_at = now(),
    error_message = NULL,
    updated_at = now()
  WHERE id = p_list_id
  RETURNING * INTO v_list;

  RETURN v_list;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_fail_list_request(p_list_id uuid, p_message text)
RETURNS public.list_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.list_requests;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;

  UPDATE public.list_requests
  SET
    status = 'failed',
    error_message = NULLIF(btrim(coalesce(p_message, '')), ''),
    completed_at = now(),
    updated_at = now()
  WHERE id = p_list_id
  RETURNING * INTO v_list;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste talebi bulunamadı.';
  END IF;
  RETURN v_list;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_list_processing(p_list_id uuid)
RETURNS public.list_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.list_requests;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;

  UPDATE public.list_requests
  SET
    status = 'processing',
    started_at = COALESCE(started_at, now()),
    error_message = NULL,
    updated_at = now()
  WHERE id = p_list_id
    AND status IN ('queued', 'processing', 'failed')
  RETURNING * INTO v_list;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste talebi güncellenemedi.';
  END IF;
  RETURN v_list;
END;
$$;

CREATE OR REPLACE FUNCTION public._list_row_json(r public.list_businesses)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', r.id,
    'business_name', r.business_name,
    'phone', r.phone,
    'website', r.website,
    'email', r.email,
    'address', r.address,
    'city', r.city,
    'district', r.district,
    'rating', r.rating,
    'review_count', r.review_count,
    'google_maps_url', r.google_maps_url
  );
$$;

CREATE OR REPLACE FUNCTION public.get_list_detail(p_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.list_requests;
  v_stats public.list_statistics;
  v_unlocked boolean := false;
  v_balance integer := 0;
  v_preview jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  SELECT * INTO v_list FROM public.list_requests WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste bulunamadı.';
  END IF;
  IF v_list.user_id <> auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu listeye erişim yetkin yok.';
  END IF;

  SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = v_list.user_id;
  v_balance := COALESCE(v_balance, 0);

  SELECT EXISTS (
    SELECT 1 FROM public.list_unlocks
    WHERE list_id = p_list_id AND user_id = v_list.user_id
  ) INTO v_unlocked;

  IF v_list.status = 'ready' THEN
    SELECT * INTO v_stats FROM public.list_statistics WHERE list_id = p_list_id;
    SELECT coalesce(jsonb_agg(public._list_row_json(b) ORDER BY b.business_name NULLS LAST, b.id), '[]'::jsonb)
    INTO v_preview
    FROM public.list_businesses b
    WHERE b.list_id = p_list_id AND b.is_preview;
  END IF;

  RETURN jsonb_build_object(
    'list', to_jsonb(v_list),
    'statistics', to_jsonb(v_stats),
    'preview', v_preview,
    'unlocked', v_unlocked,
    'balance', v_balance,
    'credits_needed', COALESCE(v_list.business_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_list_rows(
  p_list_id uuid,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.list_requests;
  v_unlocked boolean := false;
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_off integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  SELECT * INTO v_list FROM public.list_requests WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste bulunamadı.';
  END IF;
  IF v_list.user_id <> auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu listeye erişim yetkin yok.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.list_unlocks
    WHERE list_id = p_list_id AND user_id = v_list.user_id
  ) INTO v_unlocked;

  IF v_list.status <> 'ready' THEN
    RETURN jsonb_build_object('rows', '[]'::jsonb, 'total', 0, 'unlocked', v_unlocked);
  END IF;

  IF v_unlocked THEN
    SELECT count(*) INTO v_total FROM public.list_businesses WHERE list_id = p_list_id;
    SELECT coalesce(jsonb_agg(public._list_row_json(x) ORDER BY x.ord), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT b.*, row_number() OVER (ORDER BY b.business_name NULLS LAST, b.id) AS ord
      FROM public.list_businesses b
      WHERE b.list_id = p_list_id
      ORDER BY b.business_name NULLS LAST, b.id
      OFFSET v_off LIMIT v_lim
    ) x;
  ELSE
    SELECT count(*) INTO v_total FROM public.list_businesses WHERE list_id = p_list_id AND is_preview;
    SELECT coalesce(jsonb_agg(public._list_row_json(x) ORDER BY x.ord), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT b.*, row_number() OVER (ORDER BY b.business_name NULLS LAST, b.id) AS ord
      FROM public.list_businesses b
      WHERE b.list_id = p_list_id AND b.is_preview
      ORDER BY b.business_name NULLS LAST, b.id
      OFFSET v_off LIMIT v_lim
    ) x;
  END IF;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total, 'unlocked', v_unlocked);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_list_export(p_list_id uuid, p_preview_only boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.list_requests;
  v_unlocked boolean := false;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  SELECT * INTO v_list FROM public.list_requests WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste bulunamadı.';
  END IF;
  IF v_list.user_id <> auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu listeye erişim yetkin yok.';
  END IF;
  IF v_list.status <> 'ready' THEN
    RAISE EXCEPTION 'Liste henüz hazır değil.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.list_unlocks
    WHERE list_id = p_list_id AND user_id = v_list.user_id
  ) INTO v_unlocked;

  IF NOT p_preview_only AND NOT v_unlocked THEN
    RAISE EXCEPTION 'Tam listeyi indirmek için önce listeyi açmalısın.';
  END IF;

  IF p_preview_only THEN
    SELECT coalesce(jsonb_agg(public._list_row_json(b) ORDER BY b.business_name NULLS LAST, b.id), '[]'::jsonb)
    INTO v_rows
    FROM public.list_businesses b
    WHERE b.list_id = p_list_id AND b.is_preview;
  ELSE
    SELECT coalesce(jsonb_agg(public._list_row_json(b) ORDER BY b.business_name NULLS LAST, b.id), '[]'::jsonb)
    INTO v_rows
    FROM public.list_businesses b
    WHERE b.list_id = p_list_id;
  END IF;

  RETURN jsonb_build_object(
    'title', v_list.title,
    'preview_only', p_preview_only,
    'rows', v_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_list(p_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.list_requests;
  v_wallet public.credit_wallets;
  v_unlock public.list_unlocks;
  v_cost integer;
  v_already boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('unlock:' || auth.uid()::text || ':' || p_list_id::text));

  SELECT * INTO v_list FROM public.list_requests WHERE id = p_list_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste bulunamadı.';
  END IF;
  IF v_list.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Bu listeye erişim yetkin yok.';
  END IF;
  IF v_list.status <> 'ready' THEN
    RAISE EXCEPTION 'Liste henüz hazır değil.';
  END IF;

  SELECT * INTO v_unlock
  FROM public.list_unlocks
  WHERE list_id = p_list_id AND user_id = auth.uid()
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO v_wallet FROM public.credit_wallets WHERE user_id = auth.uid();
    RETURN jsonb_build_object(
      'ok', true,
      'already_unlocked', true,
      'credits_spent', v_unlock.credits_spent,
      'balance', COALESCE(v_wallet.balance, 0)
    );
  END IF;

  INSERT INTO public.credit_wallets (user_id, balance)
  VALUES (auth.uid(), 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.credit_wallets WHERE user_id = auth.uid() FOR UPDATE;

  v_cost := COALESCE(v_list.business_count, 0);
  IF v_cost > 0 AND v_wallet.balance < v_cost THEN
    RAISE EXCEPTION 'Yeterli krediniz bulunmuyor. Bu listeyi açmak için % krediye ihtiyacınız var.', v_cost;
  END IF;

  IF v_cost > 0 THEN
    UPDATE public.credit_wallets
    SET balance = balance - v_cost, updated_at = now()
    WHERE user_id = auth.uid()
    RETURNING * INTO v_wallet;
  END IF;

  INSERT INTO public.list_unlocks (list_id, user_id, credits_spent)
  VALUES (p_list_id, auth.uid(), v_cost)
  RETURNING * INTO v_unlock;

  INSERT INTO public.credit_transactions (
    user_id, amount, balance_after, transaction_type, description, list_id, idempotency_key
  )
  VALUES (
    auth.uid(),
    -v_cost,
    v_wallet.balance,
    'list_unlock',
    v_list.title,
    p_list_id,
    'unlock:' || p_list_id::text || ':' || auth.uid()::text
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_unlocked', false,
    'credits_spent', v_cost,
    'balance', v_wallet.balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_balance integer := 0;
  v_total integer := 0;
  v_ready integer := 0;
  v_preparing integer := 0;
  v_failed integer := 0;
  v_ready_locked integer := 0;
  v_recent jsonb := '[]'::jsonb;
BEGIN
  v_profile := public.ensure_my_profile();
  SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = auth.uid();

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'ready'),
    count(*) FILTER (WHERE status IN ('queued', 'processing')),
    count(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_ready, v_preparing, v_failed
  FROM public.list_requests
  WHERE user_id = auth.uid();

  SELECT count(*) INTO v_ready_locked
  FROM public.list_requests lr
  WHERE lr.user_id = auth.uid()
    AND lr.status = 'ready'
    AND NOT EXISTS (
      SELECT 1 FROM public.list_unlocks u
      WHERE u.list_id = lr.id AND u.user_id = lr.user_id
    );

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT *
    FROM public.list_requests
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 5
  ) x;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'balance', COALESCE(v_balance, 0),
    'counts', jsonb_build_object(
      'total', v_total,
      'ready', v_ready,
      'preparing', v_preparing,
      'failed', v_failed,
      'ready_locked', v_ready_locked
    ),
    'recent', v_recent
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin credit + customers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_user_id uuid,
  p_package_id uuid,
  p_payment_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg public.credit_packages;
  v_wallet public.credit_wallets;
  v_ref text;
  v_desc text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı seçilmedi.';
  END IF;

  SELECT * INTO v_pkg FROM public.credit_packages WHERE id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kredi paketi bulunamadı.';
  END IF;

  v_ref := NULLIF(btrim(coalesce(p_payment_reference, '')), '');
  IF v_ref IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.credit_transactions
      WHERE lower(btrim(payment_reference)) = lower(v_ref)
    ) THEN
      RAISE EXCEPTION 'Bu Shopier sipariş referansı ile daha önce kredi yüklenmiş.';
    END IF;
  END IF;

  INSERT INTO public.credit_wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.credit_wallets WHERE user_id = p_user_id FOR UPDATE;

  UPDATE public.credit_wallets
  SET balance = balance + v_pkg.credits, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_wallet;

  v_desc := v_pkg.credits::text || ' Kredi Paketi';
  IF NULLIF(btrim(coalesce(p_note, '')), '') IS NOT NULL THEN
    v_desc := v_desc || ' — ' || btrim(p_note);
  END IF;

  INSERT INTO public.credit_transactions (
    user_id, amount, balance_after, transaction_type, description,
    package_id, admin_id, payment_reference
  )
  VALUES (
    p_user_id,
    v_pkg.credits,
    v_wallet.balance,
    'purchase',
    v_desc,
    v_pkg.id,
    auth.uid(),
    v_ref
  );

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_wallet.balance,
    'credits_granted', v_pkg.credits
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_customers(p_query text DEFAULT '', p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);
  v_rows jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.full_name,
      p.email,
      p.phone,
      p.role,
      p.onboarding_completed,
      p.created_at,
      coalesce(w.balance, 0) AS balance,
      coalesce((
        SELECT sum(amount) FROM public.credit_transactions t
        WHERE t.user_id = p.id AND t.amount > 0
      ), 0) AS total_loaded,
      coalesce((
        SELECT sum(-amount) FROM public.credit_transactions t
        WHERE t.user_id = p.id AND t.amount < 0
      ), 0) AS total_spent
    FROM public.profiles p
    LEFT JOIN public.credit_wallets w ON w.user_id = p.id
    WHERE p.role = 'customer'
      AND (
        v_q = ''
        OR lower(coalesce(p.full_name, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(p.email, '')) LIKE '%' || v_q || '%'
        OR coalesce(p.phone, '') LIKE '%' || v_q || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT v_lim
  ) x;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_customer(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_balance integer := 0;
  v_loaded integer := 0;
  v_spent integer := 0;
  v_onboarding public.onboarding_responses;
  v_lists jsonb := '[]'::jsonb;
  v_tx jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kullanıcı bulunamadı.';
  END IF;

  SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = p_user_id;
  SELECT coalesce(sum(amount), 0) INTO v_loaded FROM public.credit_transactions WHERE user_id = p_user_id AND amount > 0;
  SELECT coalesce(sum(-amount), 0) INTO v_spent FROM public.credit_transactions WHERE user_id = p_user_id AND amount < 0;
  SELECT * INTO v_onboarding FROM public.onboarding_responses WHERE user_id = p_user_id;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_lists
  FROM (
    SELECT id, title, status, business_count, created_at, keywords, cities
    FROM public.list_requests
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) x;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_tx
  FROM (
    SELECT id, amount, balance_after, transaction_type, description, payment_reference, created_at
    FROM public.credit_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 30
  ) x;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'balance', COALESCE(v_balance, 0),
    'total_loaded', v_loaded,
    'total_spent', v_spent,
    'onboarding', to_jsonb(v_onboarding),
    'lists', v_lists,
    'transactions', v_tx
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: tighten existing scrape tables, lock new customer tables
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS admin_all_projects ON public.projects;
DROP POLICY IF EXISTS admin_all_scan_jobs ON public.scan_jobs;
DROP POLICY IF EXISTS admin_all_scan_tasks ON public.scan_tasks;
DROP POLICY IF EXISTS admin_all_businesses ON public.businesses;
DROP POLICY IF EXISTS admin_all_scan_results ON public.scan_results;
DROP POLICY IF EXISTS admin_all_workers ON public.workers;
DROP POLICY IF EXISTS admin_all_scrape_errors ON public.scrape_errors;
DROP POLICY IF EXISTS admin_read_app_config ON public.app_config;

CREATE POLICY admin_all_projects ON public.projects FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY admin_all_scan_jobs ON public.scan_jobs FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY admin_all_scan_tasks ON public.scan_tasks FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY admin_all_businesses ON public.businesses FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY admin_all_scan_results ON public.scan_results FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY admin_all_workers ON public.workers FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY admin_all_scrape_errors ON public.scrape_errors FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY admin_read_app_config ON public.app_config FOR SELECT TO authenticated
  USING (public.is_platform_admin());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY onboarding_select_own ON public.onboarding_responses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY onboarding_write_own ON public.onboarding_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY onboarding_update_own ON public.onboarding_responses FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY notif_select_own ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY notif_update_own ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY lists_select_own ON public.list_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY list_stats_select_own ON public.list_statistics FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.list_requests r
      WHERE r.id = list_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY packages_read ON public.credit_packages FOR SELECT TO authenticated
  USING (is_active OR public.is_platform_admin());
CREATE POLICY packages_admin ON public.credit_packages FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY wallets_select_own ON public.credit_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY tx_select_own ON public.credit_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY unlocks_select_own ON public.list_unlocks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

-- list_businesses: müşteri doğrudan okuyamaz; yalnızca RPC
CREATE POLICY list_businesses_admin ON public.list_businesses FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.onboarding_responses FROM anon;
REVOKE ALL ON TABLE public.notification_preferences FROM anon;
REVOKE ALL ON TABLE public.list_requests FROM anon;
REVOKE ALL ON TABLE public.list_businesses FROM anon;
REVOKE ALL ON TABLE public.list_statistics FROM anon;
REVOKE ALL ON TABLE public.credit_packages FROM anon;
REVOKE ALL ON TABLE public.credit_wallets FROM anon;
REVOKE ALL ON TABLE public.credit_transactions FROM anon;
REVOKE ALL ON TABLE public.list_unlocks FROM anon;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.onboarding_responses TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.notification_preferences TO authenticated;
GRANT SELECT ON TABLE public.list_requests TO authenticated;
GRANT SELECT ON TABLE public.list_statistics TO authenticated;
GRANT SELECT ON TABLE public.credit_packages TO authenticated;
GRANT SELECT ON TABLE public.credit_wallets TO authenticated;
GRANT SELECT ON TABLE public.credit_transactions TO authenticated;
GRANT SELECT ON TABLE public.list_unlocks TO authenticated;
GRANT SELECT ON TABLE public.list_businesses TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_onboarding(integer, text, text, text[], text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_list_request(text, text[], text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_list_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_list_rows(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_list_export(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_list_request(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fail_list_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_list_processing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_credits(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_customers(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_customer(uuid) TO authenticated;
