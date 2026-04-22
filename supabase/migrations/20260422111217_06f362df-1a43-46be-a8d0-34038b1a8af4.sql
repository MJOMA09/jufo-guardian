-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Saved searches
CREATE TABLE public.scifilter_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  year_from INTEGER,
  year_to INTEGER,
  domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scifilter_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own searches" ON public.scifilter_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own searches" ON public.scifilter_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own searches" ON public.scifilter_searches FOR DELETE USING (auth.uid() = user_id);

-- Saved papers (per search)
CREATE TABLE public.scifilter_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_id UUID NOT NULL REFERENCES public.scifilter_searches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doi TEXT,
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  source TEXT,
  abstract TEXT,
  url TEXT,
  citations INTEGER DEFAULT 0,
  concepts JSONB DEFAULT '[]'::jsonb,
  relevance TEXT CHECK (relevance IN ('High','Medium','Low')),
  relevance_score NUMERIC,
  explanation TEXT,
  feedback TEXT CHECK (feedback IN ('relevant','not_relevant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scifilter_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own papers" ON public.scifilter_papers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own papers" ON public.scifilter_papers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own papers" ON public.scifilter_papers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own papers" ON public.scifilter_papers FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_scifilter_papers_search ON public.scifilter_papers(search_id);
CREATE INDEX idx_scifilter_searches_user ON public.scifilter_searches(user_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();