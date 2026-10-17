-- ============================================================================
-- Admin area (/admin): who is an admin, and triage status for content reports.
-- ============================================================================

-- Admins. RLS on with no policies: only the server (service role) can read or change it,
-- so nobody can make themselves admin through the API. Add one with:
--   insert into public.admins (user_id) values ('<auth user id>');
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Reports get the same triage as feedback
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'
  CHECK (status IN ('new', 'fixed', 'ignored'));

-- Belt and braces: not even visible to API roles
REVOKE ALL ON public.admins FROM anon, authenticated;
