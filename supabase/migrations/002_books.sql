-- ============================================================
-- 002_books.sql
-- Book catalog: books, authors, publishers, genres
-- Populated by backend import jobs (service_role only for writes)
-- ============================================================

CREATE TABLE public.authors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  sort_name        TEXT NOT NULL,   -- "Hugo, Victor" for alphabetical sorting
  bio              TEXT,
  birth_date       DATE,
  death_date       DATE,
  photo_url        TEXT,
  openlibrary_key  TEXT UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.publishers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.books (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  subtitle         TEXT,
  description      TEXT,
  language         TEXT NOT NULL DEFAULT 'fr',
  page_count       INT CHECK (page_count > 0),
  published_date   DATE,
  publisher_id     UUID REFERENCES public.publishers(id) ON DELETE SET NULL,
  cover_url        TEXT,
  -- External source identifiers
  isbn_10          TEXT UNIQUE,
  isbn_13          TEXT UNIQUE,
  google_books_id  TEXT UNIQUE,
  openlibrary_key  TEXT UNIQUE,
  -- Denormalized aggregate stats (updated via triggers in 004_reviews.sql)
  avg_rating       NUMERIC(3,2) CHECK (avg_rating BETWEEN 1 AND 10),
  rating_count     INT NOT NULL DEFAULT 0,
  review_count     INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.book_authors (
  book_id       UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'author', -- 'author', 'translator', 'illustrator'
  display_order SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, author_id, role)
);

CREATE TABLE public.genres (
  id    SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug  TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL  -- French label e.g. "Science-Fiction"
);

CREATE TABLE public.book_genres (
  book_id   UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  genre_id  SMALLINT NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_id)
);

-- Triggers
CREATE TRIGGER trg_authors_updated_at
  BEFORE UPDATE ON public.authors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_books_language        ON public.books(language);
CREATE INDEX idx_books_published_date  ON public.books(published_date DESC);
CREATE INDEX idx_books_avg_rating      ON public.books(avg_rating DESC NULLS LAST);
CREATE INDEX idx_book_authors_author   ON public.book_authors(author_id);
CREATE INDEX idx_book_genres_genre     ON public.book_genres(genre_id);

-- Full-text search indexes
CREATE INDEX idx_books_fts ON public.books
  USING GIN(to_tsvector('french', coalesce(title,'') || ' ' || coalesce(subtitle,'')));
CREATE INDEX idx_authors_fts ON public.authors
  USING GIN(to_tsvector('simple', name));

-- ============================================================
-- RLS — catalog is public read; writes restricted to service_role
-- (no INSERT/UPDATE/DELETE policies for authenticated = implicit deny)
-- ============================================================

ALTER TABLE public.books        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_genres  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_select_all"        ON public.books        FOR SELECT USING (true);
CREATE POLICY "authors_select_all"      ON public.authors      FOR SELECT USING (true);
CREATE POLICY "publishers_select_all"   ON public.publishers   FOR SELECT USING (true);
CREATE POLICY "book_authors_select_all" ON public.book_authors FOR SELECT USING (true);
CREATE POLICY "genres_select_all"       ON public.genres       FOR SELECT USING (true);
CREATE POLICY "book_genres_select_all"  ON public.book_genres  FOR SELECT USING (true);
