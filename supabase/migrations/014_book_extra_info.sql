-- ============================================================
-- 014_book_extra_info.sql
-- Add first_published_date, edition_format, series_name, series_position
-- ============================================================

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS first_published_date DATE,
  ADD COLUMN IF NOT EXISTS edition_format       TEXT,   -- e.g. 'Poche', 'Grand format', 'Ebook', 'Relié'
  ADD COLUMN IF NOT EXISTS series_name          TEXT,
  ADD COLUMN IF NOT EXISTS series_position      NUMERIC(5,1); -- allows "3.5" for half-entries
