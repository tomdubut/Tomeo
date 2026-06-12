-- ============================================================
-- 007_recommendations.sql
-- Simple collaborative filtering: follows-based + item similarity.
-- No ML — pure SQL. Refresh mv_book_similarities via cron/Edge Function.
-- ============================================================

-- Item-item similarity based on shared high-rating readers.
-- Populated by: REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_book_similarities;
CREATE MATERIALIZED VIEW public.mv_book_similarities AS
  SELECT
    r1.book_id          AS book_id,
    r2.book_id          AS similar_book_id,
    COUNT(*)            AS shared_readers,
    AVG(r2.score)       AS avg_score
  FROM public.ratings r1
  JOIN public.ratings r2
    ON  r1.user_id = r2.user_id
    AND r1.book_id <> r2.book_id
    AND r1.score >= 7
    AND r2.score >= 7
  GROUP BY r1.book_id, r2.book_id
  HAVING COUNT(*) >= 2
WITH NO DATA;

CREATE UNIQUE INDEX ON public.mv_book_similarities(book_id, similar_book_id);
CREATE INDEX ON public.mv_book_similarities(book_id, shared_readers DESC);

-- Follows-based recommendations:
-- "Books your followed users rated highly that you haven't read yet"
CREATE OR REPLACE FUNCTION public.get_recommendations_for_user(
  p_user_id UUID,
  p_limit   INT DEFAULT 20
)
RETURNS TABLE(book_id UUID, score NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    ub.book_id,
    AVG(r.score)::NUMERIC AS score
  FROM public.follows f
  JOIN public.user_books ub
    ON  ub.user_id = f.following_id
    AND ub.status  = 'read'
  JOIN public.ratings r
    ON  r.user_id = f.following_id
    AND r.book_id = ub.book_id
  WHERE f.follower_id = p_user_id
    AND ub.book_id NOT IN (
      SELECT book_id FROM public.user_books WHERE user_id = p_user_id
    )
  GROUP BY ub.book_id
  ORDER BY score DESC, COUNT(*) DESC
  LIMIT p_limit;
$$;
