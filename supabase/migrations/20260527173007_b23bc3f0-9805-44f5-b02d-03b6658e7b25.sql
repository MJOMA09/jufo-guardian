
-- Extend scifilter_papers with explainability + workflow fields
ALTER TABLE public.scifilter_papers
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS methodology text,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS applicability text,
  ADD COLUMN IF NOT EXISTS related_authors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reason_breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS collection_id uuid;

-- Collections
CREATE TABLE IF NOT EXISTS public.scifilter_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_collections TO authenticated;
GRANT ALL ON public.scifilter_collections TO service_role;
ALTER TABLE public.scifilter_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or shared collections" ON public.scifilter_collections
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_shared = true);
CREATE POLICY "Insert own collections" ON public.scifilter_collections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own collections" ON public.scifilter_collections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own collections" ON public.scifilter_collections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_scifilter_collections_updated
  BEFORE UPDATE ON public.scifilter_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Annotations (findings/highlights per paper)
CREATE TABLE IF NOT EXISTS public.scifilter_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  kind text NOT NULL DEFAULT 'finding', -- finding | note | handover
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_annotations TO authenticated;
GRANT ALL ON public.scifilter_annotations TO service_role;
ALTER TABLE public.scifilter_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or shared annotations" ON public.scifilter_annotations
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_shared = true);
CREATE POLICY "Insert own annotations" ON public.scifilter_annotations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own annotations" ON public.scifilter_annotations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own annotations" ON public.scifilter_annotations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_scifilter_annotations_updated
  BEFORE UPDATE ON public.scifilter_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Team comments
CREATE TABLE IF NOT EXISTS public.scifilter_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_comments TO authenticated;
GRANT ALL ON public.scifilter_comments TO service_role;
ALTER TABLE public.scifilter_comments ENABLE ROW LEVEL SECURITY;

-- Comments are always visible to authenticated users (team collaboration)
CREATE POLICY "Authenticated view comments" ON public.scifilter_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own comments" ON public.scifilter_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own comments" ON public.scifilter_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own comments" ON public.scifilter_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scifilter_annotations_paper ON public.scifilter_annotations(paper_id);
CREATE INDEX IF NOT EXISTS idx_scifilter_comments_paper ON public.scifilter_comments(paper_id);
CREATE INDEX IF NOT EXISTS idx_scifilter_papers_collection ON public.scifilter_papers(collection_id);
