CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('suggestion', 'problem', 'complaint')),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_user
  ON public.support_messages (user_id, created_at DESC);

CREATE INDEX idx_support_messages_status
  ON public.support_messages (status, created_at DESC);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_messages_select ON public.support_messages;
CREATE POLICY support_messages_select ON public.support_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

REVOKE ALL ON TABLE public.support_messages FROM anon, authenticated;
GRANT SELECT ON TABLE public.support_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.create_support_message(
  p_kind text,
  p_body text
)
RETURNS public.support_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_body text := btrim(coalesce(p_body, ''));
  v_recent integer;
  v_row public.support_messages;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı, lütfen tekrar giriş yapın.';
  END IF;
  IF v_kind NOT IN ('suggestion', 'problem', 'complaint') THEN
    RAISE EXCEPTION 'Bildirim türü geçersiz.';
  END IF;
  IF char_length(v_body) < 10 THEN
    RAISE EXCEPTION 'Mesaj en az 10 karakter olmalı.';
  END IF;
  IF char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Mesaj en fazla 2000 karakter olabilir.';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.support_messages
  WHERE user_id = v_uid
    AND created_at > now() - interval '1 day';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Bugün en fazla 10 mesaj gönderebilirsin.';
  END IF;

  INSERT INTO public.support_messages (user_id, kind, body)
  VALUES (v_uid, v_kind, v_body)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_support_messages()
RETURNS TABLE (
  id uuid,
  kind text,
  body text,
  status text,
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
  SELECT m.id, m.kind, m.body, m.status, m.created_at
  FROM public.support_messages m
  WHERE m.user_id = auth.uid()
  ORDER BY m.created_at DESC
  LIMIT 30;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_support_message(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_support_messages() TO authenticated;
