-- ============================================================================
-- Owned volumes: which volumes of a manga series a user owns or has ordered
-- ============================================================================
-- One row per volume the user has (missing volumes have no row). Separate from
-- user_manga: a series can be collected without a reading status, and "owned"
-- is independent of "read" (I own 1-20, I've read 1-15).

CREATE TABLE IF NOT EXISTS public.user_manga_volumes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manga_id uuid NOT NULL REFERENCES public.manga_series(id) ON DELETE CASCADE,
  volume integer NOT NULL CHECK (volume BETWEEN 1 AND 1000),
  status text NOT NULL CHECK (status IN ('owned', 'ordered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, manga_id, volume)
);

CREATE TRIGGER set_user_manga_volumes_updated_at
  BEFORE UPDATE ON public.user_manga_volumes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_manga_volumes ENABLE ROW LEVEL SECURITY;

-- Private to the collector for now (nothing on profiles shows collections yet)
CREATE POLICY user_manga_volumes_owner ON public.user_manga_volumes
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
