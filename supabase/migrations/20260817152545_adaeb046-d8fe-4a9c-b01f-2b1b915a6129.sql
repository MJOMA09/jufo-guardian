-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Projects
CREATE TABLE IF NOT EXISTS public.scifilter_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_projects TO authenticated;
GRANT ALL ON public.scifilter_projects TO service_role;
ALTER TABLE public.scifilter_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own projects" ON public.scifilter_projects;
CREATE POLICY "own projects" ON public.scifilter_projects FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Saved searches
CREATE TABLE IF NOT EXISTS public.scifilter_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  query text NOT NULL,
  year_from int,
  year_to int,
  domain text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_saved_searches TO authenticated;
GRANT ALL ON public.scifilter_saved_searches TO service_role;
ALTER TABLE public.scifilter_saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved searches" ON public.scifilter_saved_searches;
CREATE POLICY "own saved searches" ON public.scifilter_saved_searches FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notes
CREATE TABLE IF NOT EXISTS public.scifilter_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scifilter_notes TO authenticated;
GRANT ALL ON public.scifilter_notes TO service_role;
ALTER TABLE public.scifilter_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own or shared notes" ON public.scifilter_notes;
CREATE POLICY "read own or shared notes" ON public.scifilter_notes FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_shared);
DROP POLICY IF EXISTS "write own notes" ON public.scifilter_notes;
CREATE POLICY "write own notes" ON public.scifilter_notes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update own notes" ON public.scifilter_notes;
CREATE POLICY "update own notes" ON public.scifilter_notes FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "delete own notes" ON public.scifilter_notes;
CREATE POLICY "delete own notes" ON public.scifilter_notes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Admin visibility for the admin dashboard
DROP POLICY IF EXISTS "admins view all searches" ON public.scifilter_searches;
CREATE POLICY "admins view all searches" ON public.scifilter_searches FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins view all papers" ON public.scifilter_papers;
CREATE POLICY "admins view all papers" ON public.scifilter_papers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins view all profiles" ON public.profiles;
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed admin role for the designated admin account if present
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) IN ('ayofolaposy@gmail.com')
ON CONFLICT DO NOTHING;