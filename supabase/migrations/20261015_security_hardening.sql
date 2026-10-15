-- ============================================================================
-- Security hardening (Supabase security advisor, 2026-10-15)
-- ============================================================================

-- get_recommendations_for_user(p_user_id) is SECURITY DEFINER and takes any
-- user id: callable by anyone via /rest/v1/rpc, it bypassed the user_books
-- privacy rules (is_private, profiles.is_public). It isn't used by the app.
REVOKE EXECUTE ON FUNCTION public.get_recommendations_for_user(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Trigger / event-trigger functions must not be callable as RPC. Triggers keep
-- firing: EXECUTE is only checked when a trigger is created, not when it fires.
REVOKE EXECUTE ON FUNCTION public.log_activity()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_book_rating_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_manga_avg_rating()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()           FROM PUBLIC, anon, authenticated;

-- Fixed search_path on the remaining functions flagged as mutable
ALTER FUNCTION public.set_updated_at()                              SET search_path = public;
ALTER FUNCTION public.update_book_stats()                           SET search_path = public;
ALTER FUNCTION public.get_recommendations_for_user(uuid, integer)   SET search_path = public;

-- Not used by the app; derived from ratings (already public) but no reason to expose it
REVOKE SELECT ON public.mv_book_similarities FROM anon, authenticated;
