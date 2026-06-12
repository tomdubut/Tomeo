-- ============================================================
-- 005_lists.sql
-- User-created shareable book collections
-- ============================================================

CREATE TABLE public.lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  description TEXT CHECK (length(description) <= 1000),
  is_public   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Position uses fractional/float ordering so items can be inserted between
-- existing positions without rewriting all rows (e.g. insert at 1.5 between 1.0 and 2.0).
CREATE TABLE public.list_books (
  list_id   UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  book_id   UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  position  DOUBLE PRECISION NOT NULL DEFAULT 0,
  note      TEXT CHECK (length(note) <= 500),
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, book_id)
);

CREATE TRIGGER trg_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_lists_user       ON public.lists(user_id, created_at DESC);
CREATE INDEX idx_list_books_list  ON public.list_books(list_id, position);
CREATE INDEX idx_list_books_book  ON public.list_books(book_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lists_select" ON public.lists
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "lists_insert_own" ON public.lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lists_update_own" ON public.lists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lists_delete_own" ON public.lists
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "list_books_select" ON public.list_books
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE id = list_id AND (is_public = true OR user_id = auth.uid())
    )
  );

CREATE POLICY "list_books_insert_own" ON public.list_books
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND user_id = auth.uid())
  );

CREATE POLICY "list_books_update_own" ON public.list_books
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND user_id = auth.uid())
  );

CREATE POLICY "list_books_delete_own" ON public.list_books
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND user_id = auth.uid())
  );
