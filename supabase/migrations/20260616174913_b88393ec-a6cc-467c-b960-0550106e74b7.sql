
DROP POLICY IF EXISTS "anyone insert click" ON public.click_events;
CREATE POLICY "insert click for existing url" ON public.click_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id));

REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
