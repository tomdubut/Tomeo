CREATE TABLE public.profile_favourite_books (
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id   UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  position  SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 4),
  PRIMARY KEY (user_id, position)
);

ALTER TABLE public.profile_favourite_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read favourite books"
  ON public.profile_favourite_books FOR SELECT USING (true);

CREATE POLICY "Owner write favourite books"
  ON public.profile_favourite_books FOR ALL USING (auth.uid() = user_id);
