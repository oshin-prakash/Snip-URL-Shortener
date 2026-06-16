
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- URLS
CREATE TABLE public.urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX urls_user_id_idx ON public.urls(user_id);
CREATE INDEX urls_short_code_idx ON public.urls(short_code);
CREATE INDEX urls_created_at_idx ON public.urls(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.urls TO authenticated;
GRANT SELECT ON public.urls TO anon;
GRANT ALL ON public.urls TO service_role;
ALTER TABLE public.urls ENABLE ROW LEVEL SECURITY;

-- Public can SELECT only active, non-expired rows (needed for redirect lookup)
CREATE POLICY "public read active urls" ON public.urls
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "owner full read" ON public.urls FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON public.urls FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON public.urls FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner delete" ON public.urls FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CLICK EVENTS
CREATE TABLE public.click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id UUID NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  browser TEXT,
  device TEXT,
  country TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX click_events_url_id_idx ON public.click_events(url_id);
CREATE INDEX click_events_created_at_idx ON public.click_events(created_at DESC);

GRANT INSERT ON public.click_events TO anon, authenticated;
GRANT SELECT ON public.click_events TO authenticated;
GRANT ALL ON public.click_events TO service_role;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

-- Anyone can log a click (server route uses anon key)
CREATE POLICY "anyone insert click" ON public.click_events FOR INSERT TO anon, authenticated WITH CHECK (true);
-- Only URL owner can read their analytics
CREATE POLICY "owner read clicks" ON public.click_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND u.user_id = auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER urls_updated_at BEFORE UPDATE ON public.urls FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
