-- 1. Lock down SECURITY DEFINER / helper functions from anon (and PUBLIC)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_sifter_admin_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sifter_recent_searches() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sifter_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_sifter_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sifter_recent_searches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sifter_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. admin_otp: fully locked to app roles, service_role only
ALTER TABLE public.admin_otp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_otp FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_otp TO service_role;

-- 3. Restrict comment visibility
DROP POLICY IF EXISTS "Authenticated view comments" ON public.scifilter_comments;
CREATE POLICY "View own or own-paper comments"
ON public.scifilter_comments
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.scifilter_papers p
    WHERE p.id = scifilter_comments.paper_id AND p.user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';