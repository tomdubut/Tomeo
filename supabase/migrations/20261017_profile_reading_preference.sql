-- What a user mainly reads, asked at onboarding (changeable in settings). Sets which tab the
-- catalogue and search open on, and the welcome suggestions. NULL = not answered (books).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_media text
  CHECK (preferred_media IN ('books', 'manga', 'both'));
