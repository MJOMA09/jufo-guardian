ALTER TABLE public.scifilter_comments ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;
ALTER TABLE public.scifilter_comments ADD COLUMN IF NOT EXISTS author_label text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_comments TO authenticated;
GRANT ALL ON public.scifilter_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_annotations TO authenticated;
GRANT ALL ON public.scifilter_annotations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_collections TO authenticated;
GRANT ALL ON public.scifilter_collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_notes TO authenticated;
GRANT ALL ON public.scifilter_notes TO service_role;

ALTER TABLE public.scifilter_comments REPLICA IDENTITY FULL;
ALTER TABLE public.scifilter_annotations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='scifilter_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scifilter_comments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='scifilter_annotations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scifilter_annotations;
  END IF;
END $$;