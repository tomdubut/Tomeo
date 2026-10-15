-- French volume count (highest tome published by the French publisher),
-- alongside jp_volume_count (Japanese volumes, from AniList).
ALTER TABLE public.manga_series ADD COLUMN IF NOT EXISTS fr_volume_count INT;
