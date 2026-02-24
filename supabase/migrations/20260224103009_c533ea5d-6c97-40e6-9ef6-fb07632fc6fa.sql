
-- Create table for JUFO reference database entries
CREATE TABLE public.jufo_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  issn TEXT DEFAULT '',
  level INTEGER NOT NULL DEFAULT 0,
  norwegian_level INTEGER,
  publisher TEXT DEFAULT '',
  type TEXT DEFAULT 'journal',
  year INTEGER,
  evaluated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_jufo_entries_name ON public.jufo_entries USING btree (lower(name));
CREATE INDEX idx_jufo_entries_issn ON public.jufo_entries USING btree (issn);
CREATE INDEX idx_jufo_entries_year ON public.jufo_entries USING btree (year);

-- Enable RLS (public read, admin-only write via service role in edge functions)
ALTER TABLE public.jufo_entries ENABLE ROW LEVEL SECURITY;

-- Everyone can read JUFO data (it's a public reference database)
CREATE POLICY "JUFO entries are publicly readable"
  ON public.jufo_entries FOR SELECT
  USING (true);

-- No direct inserts/updates/deletes from client - managed via edge functions with service role
-- This keeps write access restricted to admin operations only

-- Create metadata table for tracking imports
CREATE TABLE public.jufo_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  latest_year INTEGER NOT NULL DEFAULT extract(year from now()),
  entry_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.jufo_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JUFO metadata is publicly readable"
  ON public.jufo_metadata FOR SELECT
  USING (true);

-- Insert initial metadata row
INSERT INTO public.jufo_metadata (latest_year, entry_count, version) VALUES (extract(year from now())::int, 0, 0);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.jufo_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jufo_metadata;
