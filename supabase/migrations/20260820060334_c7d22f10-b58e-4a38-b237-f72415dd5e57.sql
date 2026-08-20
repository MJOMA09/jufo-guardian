REVOKE EXECUTE ON FUNCTION public.get_sifter_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_sifter_recent_searches() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_sifter_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sifter_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sifter_recent_searches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sifter_admin_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;