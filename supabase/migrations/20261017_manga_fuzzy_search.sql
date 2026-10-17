-- ============================================================================
-- Manga search: tolerant of typos, plurals, accents and alternative titles
-- ============================================================================
-- Before: title_fr/author ILIKE '%query%' — one typo ("Frerien"), a plural
-- ("demon slayers"), a missing accent ("Yuna") or the original title
-- ("Kimetsu no Yaiba") found nothing.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA extensions;

-- Other titles of the series (AniList English, romaji and Latin-script synonyms)
ALTER TABLE public.manga_series ADD COLUMN IF NOT EXISTS alt_titles text[] NOT NULL DEFAULT '{}';

-- Text normaliser shared by the indexed column and the query, so both sides compare alike:
-- lowercase, no accents, punctuation → space, simple plural folded ("demons" → "demon").
-- unaccent() is STABLE (it reads a dictionary); pinning the dictionary makes this safe as IMMUTABLE.
CREATE OR REPLACE FUNCTION public.search_norm(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT trim(regexp_replace(
           regexp_replace(
             lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
             '[^a-z0-9]+', ' ', 'g'),
           '([a-z]{3,})[sx]\M', '\1', 'g'))
$$;

-- array_to_string() is only STABLE (element output functions could in theory vary); for text[]
-- it is immutable, so the wrapper can be declared IMMUTABLE for the generated column.
CREATE OR REPLACE FUNCTION public.manga_search_text(title text, author text, alt_titles text[])
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT public.search_norm(title || ' ' || coalesce(author, '') || ' ' || array_to_string(alt_titles, ' '))
$$;

ALTER TABLE public.manga_series ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (public.manga_search_text(title_fr, author, alt_titles)) STORED;

CREATE INDEX IF NOT EXISTS manga_series_search_text_trgm
  ON public.manga_series USING gin (search_text extensions.gin_trgm_ops);

-- Ranked search. Exact and prefix title matches first, then substring matches, then
-- fuzzy matches ranked by the better of two scores: strict_word_similarity (the query
-- against whole words of the title, author or alternative titles — plain word_similarity
-- also matches letters stitched across words, ranking "Mukuro Naru" above "Naruto" for
-- "naruro") and edit distance to the start of the title. Ties go to longer series.
-- SECURITY INVOKER: reads manga_series with the caller's rights, like the old query.
CREATE OR REPLACE FUNCTION public.search_manga(q text, max_results integer DEFAULT 40)
RETURNS TABLE (id uuid, title_fr text, author text, publisher text, cover_url text, volume_count integer)
LANGUAGE sql
STABLE
SET search_path = ''
SET pg_trgm.word_similarity_threshold = 0.4
AS $$
  WITH query AS (SELECT public.search_norm(q) AS n)
  SELECT m.id, m.title_fr, m.author, m.publisher, m.cover_url, m.volume_count
  FROM public.manga_series m, query
  WHERE length(query.n) > 0
    AND (m.search_text LIKE '%' || query.n || '%'
         OR (length(query.n) >= 3 AND query.n OPERATOR(extensions.<%) m.search_text))
  ORDER BY
    CASE
      WHEN public.search_norm(m.title_fr) = query.n THEN 4
      WHEN public.search_norm(m.title_fr) LIKE query.n || '%' THEN 3
      WHEN m.search_text LIKE '%' || query.n || '%' THEN 2
      ELSE 1
    END DESC,
    greatest(
      extensions.strict_word_similarity(query.n, m.search_text),
      -- edit distance to the start of the title: catches swapped/missing letters that
      -- trigrams score poorly ("frerien" → "frieren")
      1 - extensions.levenshtein(query.n, left(public.search_norm(m.title_fr), length(query.n)))::real
          / greatest(length(query.n), 1)
    ) DESC,
    m.volume_count DESC NULLS LAST,
    m.title_fr
  LIMIT least(greatest(max_results, 1), 100)
$$;

GRANT EXECUTE ON FUNCTION public.search_manga(text, integer) TO anon, authenticated;
