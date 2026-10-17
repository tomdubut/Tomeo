-- ============================================================================
-- User feedback: bugs, ideas and opinions about the site ("Donner mon avis").
-- Separate from content_reports, which is about one book's or manga's data.
-- Read it in the Supabase dashboard (Table Editor → feedback); set status to triage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Kept (anonymised) when the account is deleted
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('bug', 'idea', 'other')),
  message text NOT NULL CHECK (length(message) BETWEEN 3 AND 2000),
  -- Context for bug reports: page, browser, screen size
  page text CHECK (length(page) <= 300),
  user_agent text CHECK (length(user_agent) <= 400),
  viewport text CHECK (length(viewport) <= 20),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'planned', 'done', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_created ON public.feedback (user_id, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users send feedback as themselves and can see only their own (used for the rate limit).
-- Status changes and reading everything are for the owner, in the dashboard.
CREATE POLICY feedback_insert_own ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'new');

CREATE POLICY feedback_select_own ON public.feedback
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
