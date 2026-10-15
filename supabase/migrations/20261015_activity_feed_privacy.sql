-- ============================================================================
-- Activity feed leaked private items.
--
-- log_activity() records every insert, ignoring privacy, and activity_feed's
-- SELECT policy only checked that the actor's profile is public. A private
-- review (or private library entry / private list) still showed as
-- "X reviewed <book>" in followers' feeds — the review body was hidden by
-- reviews' own RLS, but the book and the fact were not.
--
-- Fix at read time, so it also covers existing rows and items made private
-- later. The check needs to see private rows, which the viewer's RLS hides,
-- hence a SECURITY DEFINER helper that only returns a boolean.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activity_is_private(
  p_type TEXT, p_actor UUID, p_book UUID, p_review UUID, p_list UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_type = 'reviewed_book' THEN
      EXISTS (SELECT 1 FROM reviews r WHERE r.id = p_review AND r.is_private)
    WHEN p_type IN ('added_book', 'rated_book') THEN
      EXISTS (SELECT 1 FROM user_books u WHERE u.user_id = p_actor AND u.book_id = p_book AND u.is_private)
    WHEN p_type = 'created_list' THEN
      EXISTS (SELECT 1 FROM lists l WHERE l.id = p_list AND NOT l.is_public)
    ELSE false
  END
$$;

-- Policies are evaluated with the viewer's role, which needs EXECUTE
REVOKE EXECUTE ON FUNCTION public.activity_is_private(TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activity_is_private(TEXT, UUID, UUID, UUID, UUID) TO anon, authenticated;

DROP POLICY IF EXISTS activity_feed_select ON public.activity_feed;
CREATE POLICY activity_feed_select ON public.activity_feed FOR SELECT USING (
  (SELECT auth.uid()) = actor_id
  OR (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = activity_feed.actor_id AND p.is_public = true)
    AND NOT public.activity_is_private(activity_type::text, actor_id, book_id, review_id, list_id)
  )
);
