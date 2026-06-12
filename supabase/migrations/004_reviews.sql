-- ============================================================
-- 004_reviews.sql
-- Ratings (1-10) and written reviews, likes, aggregate triggers
-- ============================================================

CREATE TABLE public.ratings (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id     UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

-- A user may write at most one review per book, independent of rating.
-- Rating and review are separate: user can rate without reviewing and vice-versa.
CREATE TABLE public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id     UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 10000),
  is_spoiler  BOOLEAN NOT NULL DEFAULT false,
  is_private  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

CREATE TABLE public.review_likes (
  review_id   UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

-- Triggers for updated_at
CREATE TRIGGER trg_ratings_updated_at
  BEFORE UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_ratings_book     ON public.ratings(book_id);
CREATE INDEX idx_ratings_user     ON public.ratings(user_id);
CREATE INDEX idx_reviews_book     ON public.reviews(book_id, created_at DESC);
CREATE INDEX idx_reviews_user     ON public.reviews(user_id, created_at DESC);
CREATE INDEX idx_review_likes_rev ON public.review_likes(review_id);

-- ============================================================
-- Aggregate stats trigger on books.avg_rating / rating_count / review_count
-- Runs synchronously on every rating write — acceptable at MVP scale.
-- At scale: replace with pg_cron batch refresh.
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_book_rating_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_book_id UUID;
BEGIN
  v_book_id := COALESCE(NEW.book_id, OLD.book_id);
  UPDATE public.books SET
    avg_rating   = (SELECT AVG(score)::NUMERIC(3,2) FROM public.ratings WHERE book_id = v_book_id),
    rating_count = (SELECT COUNT(*)                 FROM public.ratings WHERE book_id = v_book_id),
    review_count = (SELECT COUNT(*)                 FROM public.reviews WHERE book_id = v_book_id AND is_private = false),
    updated_at   = now()
  WHERE id = v_book_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ratings_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_book_rating_stats();

CREATE TRIGGER trg_reviews_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_book_rating_stats();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.ratings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select_all" ON public.ratings
  FOR SELECT USING (true);

CREATE POLICY "ratings_insert_own" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ratings_update_own" ON public.ratings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ratings_delete_own" ON public.ratings
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT USING (is_private = false OR auth.uid() = user_id);

CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own" ON public.reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "review_likes_select_all" ON public.review_likes
  FOR SELECT USING (true);

CREATE POLICY "review_likes_insert_own" ON public.review_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_likes_delete_own" ON public.review_likes
  FOR DELETE USING (auth.uid() = user_id);
