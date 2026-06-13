-- Required for upsert ON CONFLICT (name) to work in importBook
CREATE UNIQUE INDEX IF NOT EXISTS idx_authors_name ON public.authors(name);
