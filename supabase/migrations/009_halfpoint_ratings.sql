-- Allow half-point ratings (e.g. 5.5) by changing score from SMALLINT to NUMERIC(3,1)
ALTER TABLE public.ratings ALTER COLUMN score TYPE NUMERIC(3,1);
