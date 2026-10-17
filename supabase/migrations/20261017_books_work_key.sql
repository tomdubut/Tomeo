-- ============================================================================
-- One book per work: books.work_key = normalised title + first author's last name + language
-- (computed by the app, src/lib/books/workKey.ts). Importing another edition of a book that's
-- already in the catalogue opens the existing book instead of creating a duplicate.
-- A French and an English edition have different keys and stay separate.
-- ============================================================================

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS work_key text;

-- Not unique: older duplicates exist until they're merged, and NULL keys (unknown language) never match
CREATE INDEX IF NOT EXISTS books_work_key_idx ON public.books (work_key) WHERE work_key IS NOT NULL;
