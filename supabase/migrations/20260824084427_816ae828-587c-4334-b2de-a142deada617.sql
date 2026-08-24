GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_projects TO authenticated;
GRANT ALL ON public.scifilter_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_saved_searches TO authenticated;
GRANT ALL ON public.scifilter_saved_searches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_notes TO authenticated;
GRANT ALL ON public.scifilter_notes TO service_role;
NOTIFY pgrst, 'reload schema';