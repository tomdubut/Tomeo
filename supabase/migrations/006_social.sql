-- ============================================================
-- 006_social.sql
-- Comments on reviews/lists + append-only activity feed
-- ============================================================

-- Polymorphic comments via nullable FKs with CHECK ensuring exactly one parent.
-- If you add a third comment target later, ALTER TABLE to add the FK and update the CHECK.
CREATE TABLE public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_id   UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  list_id     UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exactly_one_parent CHECK (
    (review_id IS NOT NULL)::int + (list_id IS NOT NULL)::int = 1
  )
);

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Activity feed — append-only event log.
-- Fan-out-on-read: feed is computed at query time by joining follows.
-- Acceptable at MVP scale with proper indexes + cursor pagination.
-- ============================================================

CREATE TYPE public.activity_type AS ENUM (
  'added_book',
  'rated_book',
  'reviewed_book',
  'created_list',
  'followed_user'
);

CREATE TABLE public.activity_feed (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type   public.activity_type NOT NULL,
  book_id         UUID REFERENCES public.books(id) ON DELETE CASCADE,
  review_id       UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  list_id         UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  target_user_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes — critical for feed query performance with cursor pagination
CREATE INDEX idx_activity_actor      ON public.activity_feed(actor_id, created_at DESC);
CREATE INDEX idx_activity_created_at ON public.activity_feed(created_at DESC);
CREATE INDEX idx_comments_review     ON public.comments(review_id, created_at);
CREATE INDEX idx_comments_list       ON public.comments(list_id, created_at);
CREATE INDEX idx_comments_user       ON public.comments(user_id, created_at DESC);

-- ============================================================
-- Auto-populate activity feed via trigger on source tables
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_TABLE_NAME = 'user_books' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_feed(actor_id, activity_type, book_id)
    VALUES (NEW.user_id, 'added_book', NEW.book_id);

  ELSIF TG_TABLE_NAME = 'ratings' AND TG_OP = 'INSERT' THEN
    -- Only on INSERT to avoid double-logging rating updates in the feed
    INSERT INTO public.activity_feed(actor_id, activity_type, book_id)
    VALUES (NEW.user_id, 'rated_book', NEW.book_id);

  ELSIF TG_TABLE_NAME = 'reviews' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_feed(actor_id, activity_type, book_id, review_id)
    VALUES (NEW.user_id, 'reviewed_book', NEW.book_id, NEW.id);

  ELSIF TG_TABLE_NAME = 'lists' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_feed(actor_id, activity_type, list_id)
    VALUES (NEW.user_id, 'created_list', NEW.id);

  ELSIF TG_TABLE_NAME = 'follows' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_feed(actor_id, activity_type, target_user_id)
    VALUES (NEW.follower_id, 'followed_user', NEW.following_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_activity_user_books AFTER INSERT ON public.user_books
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER trg_activity_ratings AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER trg_activity_reviews AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER trg_activity_lists AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER trg_activity_follows AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all" ON public.comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert_own" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update_own" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete_own" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "activity_feed_select" ON public.activity_feed
  FOR SELECT USING (
    auth.uid() = actor_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = actor_id AND is_public = true)
  );

-- Feed rows are inserted by SECURITY DEFINER triggers, not directly by users.
-- This policy covers the case where client code calls insert directly (denied for others).
CREATE POLICY "activity_feed_insert_own" ON public.activity_feed
  FOR INSERT WITH CHECK (auth.uid() = actor_id);
