-- ============================================================================
-- Monthly French volume-count refresh (daily batches, /api/cron/manga-volumes)
-- ============================================================================
-- How each series is found in the BnF catalogue, and when it was last checked.
ALTER TABLE public.manga_series
  ADD COLUMN IF NOT EXISTS bnf_series text,          -- series name as the BnF writes it ("Chainsaw man")
  ADD COLUMN IF NOT EXISTS bnf_author text,          -- author search terms ("fujimoto tatsuki")
  ADD COLUMN IF NOT EXISTS volumes_checked_at timestamptz;

-- The daily job picks the series checked longest ago
CREATE INDEX IF NOT EXISTS manga_series_volumes_checked
  ON public.manga_series (volumes_checked_at NULLS FIRST) WHERE bnf_series IS NOT NULL;
