CREATE TABLE public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.credit_packages (id) ON DELETE SET NULL,
  package_name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_try numeric(12, 2) NOT NULL CHECK (price_try >= 0),
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'cancelled')),
  admin_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  admin_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_requests_user ON public.credit_requests (user_id, created_at DESC);
CREATE INDEX idx_credit_requests_status ON public.credit_requests (status, created_at DESC);

ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_requests_select_own ON public.credit_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

REVOKE ALL ON TABLE public.credit_requests FROM anon;
GRANT SELECT ON TABLE public.credit_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_tr_mobile(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text;
BEGIN
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  IF v_digits LIKE '90%' AND length(v_digits) >= 12 THEN
    v_digits := '0' || substr(v_digits, 3);
  ELSIF v_digits LIKE '5%' AND length(v_digits) = 10 THEN
    v_digits := '0' || v_digits;
  END IF;
  RETURN substr(v_digits, 1, 11);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_credit_request(
  p_package_id uuid,
  p_email text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pkg public.credit_packages;
  v_email text;
  v_phone text;
  v_row public.credit_requests;
  v_pending integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum gerekli.';
  END IF;

  v_email := lower(btrim(coalesce(p_email, '')));
  IF v_email = '' OR position('@' IN v_email) < 2 THEN
    RAISE EXCEPTION 'Geçerli bir e-posta gir.';
  END IF;

  v_phone := public.normalize_tr_mobile(p_phone);
  IF v_phone !~ '^05[0-9]{9}$' THEN
    RAISE EXCEPTION 'Telefon 05XX XXX XX XX formatında olmalı.';
  END IF;

  SELECT * INTO v_pkg
  FROM public.credit_packages
  WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kredi paketi bulunamadı.';
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.credit_requests
  WHERE user_id = v_uid AND status = 'pending';
  IF v_pending >= 5 THEN
    RAISE EXCEPTION 'Aynı anda en fazla 5 bekleyen kredi talebin olabilir.';
  END IF;

  INSERT INTO public.credit_requests (
    user_id, package_id, package_name, credits, price_try,
    contact_email, contact_phone, status
  )
  VALUES (
    v_uid, v_pkg.id, v_pkg.name, v_pkg.credits, v_pkg.price_try,
    v_email, v_phone, 'pending'
  )
  RETURNING * INTO v_row;

  UPDATE public.profiles
  SET phone = v_phone
  WHERE id = v_uid;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_credit_request_status(
  p_request_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.credit_requests;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;
  IF p_status NOT IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'Geçersiz durum.';
  END IF;

  SELECT * INTO v_row
  FROM public.credit_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kredi talebi bulunamadı.';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Yalnızca bekleyen talepler güncellenebilir.';
  END IF;

  UPDATE public.credit_requests
  SET
    status = p_status,
    admin_id = auth.uid(),
    admin_note = NULLIF(btrim(coalesce(p_note, '')), ''),
    decided_at = now(),
    updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_tr_mobile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_credit_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_credit_request_status(uuid, text, text) TO authenticated;
