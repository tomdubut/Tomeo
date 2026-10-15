-- French volume count (highest tome published by the French publisher),
-- alongside jp_volume_count (Japanese volumes, from AniList).
ALTER TABLE public.manga_series ADD COLUMN IF NOT EXISTS fr_volume_count INT;

-- What the app displays and sorts by: the Japanese count when known, otherwise
-- the French one (AniList has no volume count for ongoing series like One Piece).
ALTER TABLE public.manga_series
  ADD COLUMN IF NOT EXISTS volume_count INT
  GENERATED ALWAYS AS (COALESCE(jp_volume_count, fr_volume_count)) STORED;
