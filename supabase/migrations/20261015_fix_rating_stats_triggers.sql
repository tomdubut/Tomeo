-- ============================================================================
-- Rating / review counters were never updated by users' own actions.
--
-- refresh_book_rating_stats() and update_manga_avg_rating() run as the calling
-- user. books and manga_series only have a SELECT policy, so the trigger's
-- UPDATE silently matched 0 rows under RLS: a user rating a book left
-- books.avg_rating / rating_count / review_count unchanged.
--
-- Fix: run them as the owner (like log_activity), with a fixed search_path.
-- They only recompute counters from ratings/reviews, so this grants nothing else.
-- ============================================================================

ALTER FUNCTION public.refresh_book_rating_stats() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_manga_avg_rating()   SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.log_activity()              SET search_path = public;

-- Created in 20260920_manga_series.sql but missing from the database
DROP TRIGGER IF EXISTS update_manga_avg_rating_on_delete ON public.manga_ratings;
CREATE TRIGGER update_manga_avg_rating_on_delete
  AFTER DELETE ON public.manga_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_manga_avg_rating();

-- One-off recompute of every counter that drifted (only rows whose values differ)
WITH s AS (
  SELECT b.id,
    (SELECT AVG(score)::NUMERIC(4,2) FROM public.ratings r WHERE r.book_id = b.id) AS avg_rating,
    (SELECT COUNT(*) FROM public.ratings r WHERE r.book_id = b.id)                   AS rating_count,
    (SELECT COUNT(*) FROM public.reviews r WHERE r.book_id = b.id AND r.is_private = false) AS review_count
  FROM public.books b
)
UPDATE public.books b
SET avg_rating = s.avg_rating, rating_count = s.rating_count, review_count = s.review_count
FROM s
WHERE s.id = b.id
  AND (b.avg_rating IS DISTINCT FROM s.avg_rating
    OR b.rating_count IS DISTINCT FROM s.rating_count
    OR b.review_count IS DISTINCT FROM s.review_count);

WITH s AS (
  SELECT m.id,
    (SELECT AVG(score) FROM public.manga_ratings r WHERE r.manga_id = m.id) AS avg_rating,
    (SELECT COUNT(*)   FROM public.manga_ratings r WHERE r.manga_id = m.id) AS rating_count
  FROM public.manga_series m
)
UPDATE public.manga_series m
SET avg_rating = s.avg_rating, rating_count = s.rating_count
FROM s
WHERE s.id = m.id
  AND (m.avg_rating IS DISTINCT FROM s.avg_rating OR m.rating_count IS DISTINCT FROM s.rating_count);
