-- ============================================================================
-- MANGA SERIES SCHEMA
-- Series-level manga tracking (like MyAnimeList / AniList).
-- Users track manga per series, not per volume.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- manga_series — catalog of manga series
-- ----------------------------------------------------------------------------
CREATE TABLE public.manga_series (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fr        TEXT NOT NULL,
  publisher       TEXT,
  anilist_id      INT UNIQUE,
  jp_volume_count INT,
  cover_url       TEXT,
  description     TEXT,
  avg_rating      NUMERIC(3,2) CHECK (avg_rating BETWEEN 1 AND 10),
  rating_count    INT NOT NULL DEFAULT 0,
  needs_review    BOOLEAN NOT NULL DEFAULT false,
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (title_fr, publisher)
);

ALTER TABLE public.manga_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manga_series_public_read"
  ON public.manga_series FOR SELECT USING (true);

CREATE TRIGGER set_manga_series_updated_at
  BEFORE UPDATE ON public.manga_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- user_manga — user's library entry for a manga series
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_manga (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manga_id     UUID NOT NULL REFERENCES public.manga_series(id) ON DELETE CASCADE,
  status       reading_status NOT NULL,
  volumes_read INT NOT NULL DEFAULT 0 CHECK (volumes_read >= 0),
  started_at   DATE,
  finished_at  DATE,
  is_private   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, manga_id)
);

ALTER TABLE public.user_manga ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_manga_owner_all"
  ON public.user_manga
  USING (auth.uid() = user_id);

CREATE POLICY "user_manga_public_read"
  ON public.user_manga FOR SELECT
  USING (is_private = false OR auth.uid() = user_id);

CREATE TRIGGER set_user_manga_updated_at
  BEFORE UPDATE ON public.user_manga
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- manga_ratings — user ratings for manga series (1–10 scale, same as books)
-- ----------------------------------------------------------------------------
CREATE TABLE public.manga_ratings (
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manga_id UUID NOT NULL REFERENCES public.manga_series(id) ON DELETE CASCADE,
  score    SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  PRIMARY KEY (user_id, manga_id)
);

ALTER TABLE public.manga_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manga_ratings_owner_all"
  ON public.manga_ratings
  USING (auth.uid() = user_id);

CREATE POLICY "manga_ratings_public_read"
  ON public.manga_ratings FOR SELECT USING (true);

-- Trigger to keep manga_series.avg_rating and rating_count up to date
CREATE OR REPLACE FUNCTION public.update_manga_avg_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.manga_series
  SET
    avg_rating   = (SELECT AVG(score) FROM public.manga_ratings WHERE manga_id = COALESCE(NEW.manga_id, OLD.manga_id)),
    rating_count = (SELECT COUNT(*)   FROM public.manga_ratings WHERE manga_id = COALESCE(NEW.manga_id, OLD.manga_id))
  WHERE id = COALESCE(NEW.manga_id, OLD.manga_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_manga_avg_rating_on_insert_or_update
  AFTER INSERT OR UPDATE ON public.manga_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_manga_avg_rating();

CREATE TRIGGER update_manga_avg_rating_on_delete
  AFTER DELETE ON public.manga_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_manga_avg_rating();
