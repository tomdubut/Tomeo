-- manga_reviews: one review per user per series
CREATE TABLE public.manga_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manga_id   UUID NOT NULL REFERENCES public.manga_series(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 10000),
  is_spoiler BOOLEAN NOT NULL DEFAULT false,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, manga_id)
);

ALTER TABLE public.manga_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manga_reviews_public_read"
  ON public.manga_reviews FOR SELECT
  USING (is_private = false OR auth.uid() = user_id);

CREATE POLICY "manga_reviews_owner_all"
  ON public.manga_reviews
  USING (auth.uid() = user_id);

CREATE TRIGGER set_manga_reviews_updated_at
  BEFORE UPDATE ON public.manga_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow half-point ratings on manga_ratings (match books)
ALTER TABLE public.manga_ratings ALTER COLUMN score TYPE NUMERIC(3,1);

-- Trigger to keep manga_series.avg_rating + rating_count in sync
-- (already created in 20260920_manga_series.sql — this is a no-op if it exists)
