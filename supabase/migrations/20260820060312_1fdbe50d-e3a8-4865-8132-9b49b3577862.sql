CREATE POLICY "admins manage roles insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage roles delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.get_sifter_users()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(t.x)
    FROM (
      SELECT jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'display_name', p.display_name,
        'searches', (SELECT count(*) FROM public.scifilter_searches s WHERE s.user_id = u.id),
        'papers', (SELECT count(*) FROM public.scifilter_papers pa WHERE pa.user_id = u.id),
        'roles', COALESCE((SELECT jsonb_agg(r.role) FROM public.user_roles r WHERE r.user_id = u.id), '[]'::jsonb)
      ) AS x
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 200
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sifter_recent_searches()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'query', s.query, 'domain', s.domain,
      'created_at', s.created_at, 'email', u.email,
      'papers', (SELECT count(*) FROM public.scifilter_papers p WHERE p.search_id = s.id)
    ))
    FROM (SELECT * FROM public.scifilter_searches ORDER BY created_at DESC LIMIT 50) s
    LEFT JOIN auth.users u ON u.id = s.user_id
  ), '[]'::jsonb);
END;
$$;