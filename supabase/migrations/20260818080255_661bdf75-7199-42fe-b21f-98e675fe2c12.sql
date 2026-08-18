CREATE OR REPLACE FUNCTION public.get_sifter_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'searches', (SELECT count(*) FROM public.scifilter_searches),
    'papers', (SELECT count(*) FROM public.scifilter_papers),
    'feedback', (SELECT count(*) FROM public.scifilter_papers WHERE feedback IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sifter_admin_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sifter_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sifter_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sifter_admin_stats() TO service_role;