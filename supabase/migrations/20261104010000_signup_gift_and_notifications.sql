-- Yeni müşteriye 20 hoş geldin kredisi ve kullanıcı bildirimleri.

DO $$
DECLARE
  v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.credit_transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%transaction_type%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.credit_transactions DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_transaction_type_check
  CHECK (transaction_type IN ('purchase', 'list_unlock', 'admin_adjustment', 'refund', 'gift'));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  href text,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_open
  ON public.notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.push_notification(
  p_user_id uuid,
  p_title text,
  p_body text DEFAULT NULL,
  p_href text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_href text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Bildirim kullanıcısı zorunludur.';
  END IF;
  IF NULLIF(btrim(coalesce(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Bildirim başlığı zorunludur.';
  END IF;

  v_href := NULLIF(btrim(coalesce(p_href, '')), '');
  IF v_href IS NOT NULL AND (
    left(v_href, 2) = '//'
    OR v_href !~ '^(/|https://)'
  ) THEN
    RAISE EXCEPTION 'Bildirim bağlantısı geçersiz.';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, href)
  VALUES (
    p_user_id,
    btrim(p_title),
    NULLIF(btrim(coalesce(p_body, '')), ''),
    v_href
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.provision_user_records(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'customer';
  v_email text := lower(trim(coalesce(p_email, '')));
  v_completed boolean := false;
  v_gift_user uuid;
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

  IF v_role = 'customer' THEN
    INSERT INTO public.credit_wallets (user_id, balance)
    VALUES (p_user_id, 20)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id INTO v_gift_user;

    IF v_gift_user IS NOT NULL THEN
      INSERT INTO public.credit_transactions (
        user_id, amount, balance_after, transaction_type, description, idempotency_key
      )
      VALUES (
        p_user_id,
        20,
        20,
        'gift',
        'Hoş geldin hediyesi',
        'signup-gift:' || p_user_id::text
      );

      PERFORM public.push_notification(
        p_user_id,
        '20 kredi hediye',
        'Hesabına hoş geldin. 20 kredi hediye olarak tanımlandı.',
        '/panel/krediler'
      );
    END IF;
  ELSE
    INSERT INTO public.credit_wallets (user_id, balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

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
  v_count integer;
  v_row public.list_requests;
  v_notice_title text;
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

  SELECT count(*) INTO v_count
  FROM public.list_requests
  WHERE user_id = auth.uid();

  v_notice_title := CASE
    WHEN v_count = 1 THEN 'İlk liste talebini aldık'
    ELSE 'Liste talebini aldık'
  END;

  PERFORM public.push_notification(
    auth.uid(),
    v_notice_title,
    '"' || v_title || '" talebini aldık. Bu yaklaşık 1 gün sürer. İşlem bitince sana haber vereceğiz.',
    NULL
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_notifications()
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  RETURN QUERY
  SELECT n.id, n.title, n.body, n.href, n.read_at, n.created_at
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
    AND n.deleted_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_notification(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;

  UPDATE public.notifications
  SET
    deleted_at = COALESCE(deleted_at, now()),
    read_at = COALESCE(read_at, now())
  WHERE id = p_id
    AND user_id = auth.uid();
END;
$$;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

REVOKE ALL ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_my_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_notification(uuid) TO authenticated;
