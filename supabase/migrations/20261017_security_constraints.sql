-- ============================================================================
-- Security review 2026-10-17: database-side limits, notifications table
-- ============================================================================

-- 1. Notifications. 012_notifications.sql was never applied to the live database: every
--    follow/comment notification insert failed silently and the notifications page was empty.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('new_follower', 'new_comment')),
  review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE,
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread ON public.notifications (user_id, read_at) WHERE read_at IS NULL;
-- One "new follower" notification per follower: a follow/unfollow loop can't flood someone
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_per_follower
  ON public.notifications (user_id, actor_id) WHERE type = 'new_follower';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can mark own notifications as read" ON public.notifications;
CREATE POLICY "Users can mark own notifications as read" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
-- No INSERT/DELETE policy: notifications are created by the server (service role) only.

-- 2. Profile fields. The forms limit lengths, but anyone can update their own row directly
--    through the API, bypassing the forms: enforce the same limits here.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length CHECK (length(display_name) <= 50),
  ADD CONSTRAINT profiles_location_length CHECK (length(location) <= 100),
  ADD CONSTRAINT profiles_website_url_format CHECK (length(website_url) <= 200 AND website_url ~ '^https?://'),
  -- Only an avatar uploaded to this project's storage: an outside URL would let its owner log
  -- the IP address of everyone viewing the profile
  ADD CONSTRAINT profiles_avatar_url_storage CHECK (
    avatar_url LIKE 'https://anwqdvinftyiosnjurxv.supabase.co/storage/v1/object/public/avatars/%'),
  ADD CONSTRAINT profiles_reading_goal_range CHECK (reading_goal BETWEEN 1 AND 1000);

-- 3. Manga progress and content reports
ALTER TABLE public.user_manga
  ADD CONSTRAINT user_manga_volumes_read_max CHECK (volumes_read <= 1000);

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_reason_known CHECK (reason IN
    ('wrong_cover', 'wrong_description', 'wrong_edition', 'wrong_isbn', 'wrong_metadata', 'wrong_volume', 'other')),
  ADD CONSTRAINT content_reports_note_length CHECK (length(note) <= 1000);

-- 4. Manga library entries follow the same rule as book library entries: hidden when the
--    owner's profile isn't public (user_books already did this, user_manga didn't).
DROP POLICY IF EXISTS user_manga_public_read ON public.user_manga;
CREATE POLICY user_manga_public_read ON public.user_manga FOR SELECT USING (
  (SELECT auth.uid()) = user_id
  OR (is_private = false AND EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = user_manga.user_id AND p.is_public = true))
);
