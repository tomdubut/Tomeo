-- ============================================================
-- 011_genres_type.sql
-- Add type column to genres: 'genre' (thematic) or 'format' (structural)
-- ============================================================

ALTER TABLE public.genres
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'genre'
  CHECK (type IN ('genre', 'format'));

UPDATE public.genres SET type = 'format' WHERE slug IN ('roman', 'bande-dessinee', 'poesie');
-- All other existing slugs remain 'genre' (the default)
