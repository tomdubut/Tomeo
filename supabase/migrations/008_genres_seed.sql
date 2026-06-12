-- ============================================================
-- 008_genres_seed.sql
-- Pre-seed common genre slugs so labels are consistent across imports
-- ============================================================

INSERT INTO public.genres (slug, label) VALUES
  ('roman',                 'Roman'),
  ('litterature',           'Littérature'),
  ('science-fiction',       'Science-Fiction'),
  ('fantastique',           'Fantastique'),
  ('policier',              'Policier'),
  ('thriller',              'Thriller'),
  ('horreur',               'Horreur'),
  ('romance',               'Romance'),
  ('roman-historique',      'Roman historique'),
  ('biographie',            'Biographie'),
  ('histoire',              'Histoire'),
  ('developpement-personnel','Développement personnel'),
  ('bande-dessinee',        'Bande dessinée'),
  ('jeunesse',              'Jeunesse'),
  ('poesie',                'Poésie'),
  ('philosophie',           'Philosophie'),
  ('psychologie',           'Psychologie'),
  ('sciences',              'Sciences'),
  ('cuisine',               'Cuisine'),
  ('voyage',                'Voyage'),
  ('art',                   'Art'),
  ('humour',                'Humour'),
  ('politique',             'Politique'),
  ('economie',              'Économie')
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label;
