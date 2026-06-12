-- ============================================================
-- 003_library.sql
-- Personal library: reading status per user per book
-- ============================================================

CREATE TYPE public.reading_status AS ENUM ('want_to_read', 'currently_reading', 'read');

CREATE TABLE public.user_books (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id      UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status       public.reading_status NOT NULL,
  started_at   DATE,
  finished_at  DATE,
  is_private   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

CREATE TRIGGER trg_user_books_updated_at
  BEFORE UPDATE ON public.user_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_user_books_user_status ON public.user_books(user_id, status);
CREATE INDEX idx_user_books_book        ON public.user_books(book_id);
CREATE INDEX idx_user_books_updated     ON public.user_books(updated_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_books_select" ON public.user_books
  FOR SELECT USING (
    auth.uid() = user_id
    OR (
      is_private = false
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
    )
  );

CREATE POLICY "user_books_insert" ON public.user_books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_books_update" ON public.user_books
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_books_delete" ON public.user_books
  FOR DELETE USING (auth.uid() = user_id);
