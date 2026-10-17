// Genre detection for imported books: Google Books categories first, then (only when they
// give no thematic genre) a few unambiguous words in the description.

type Genre = { slug: string; label: string }

// Maps Google Books category keywords (lowercase) to our genre slugs + French labels.
// Order matters: more specific entries must come before broader ones (e.g. "science fiction"
// before "science", "historical fiction" before "fiction").
// Keywords match whole words (an optional plural s/x is allowed); a trailing * makes a prefix.
const GENRE_MAP: Array<{ keywords: string[]; slug: string; label: string }> = [
  { keywords: ["science fiction", "science-fiction", "sci-fi", "sf"], slug: "science-fiction", label: "Science-Fiction" },
  { keywords: ["fantasy", "fantastique", "heroic fantasy", "high fantasy", "dark fantasy"], slug: "fantastique", label: "Fantastique" },
  { keywords: ["mystery", "mysteries", "detective", "policier", "crime fiction", "fiction / crime", "true crime", "whodunit", "noir"], slug: "policier", label: "Policier" },
  { keywords: ["thriller", "suspense", "espionnage"], slug: "thriller", label: "Thriller" },
  { keywords: ["horror", "horreur", "épouvante"], slug: "horreur", label: "Horreur" },
  { keywords: ["romance", "love stories", "sentimentale", "feel-good"], slug: "romance", label: "Romance" },
  { keywords: ["historical fiction", "fiction / historical", "roman historique", "histoire et fiction"], slug: "roman-historique", label: "Roman historique" },
  { keywords: ["biography", "autobiograph*", "biographie", "mémoires", "memoir"], slug: "biographie", label: "Biographie" },
  { keywords: ["history", "histoire", "historical"], slug: "histoire", label: "Histoire" },
  { keywords: ["self-help", "personal development", "développement personnel", "well-being", "bien-être", "motivation"], slug: "developpement-personnel", label: "Développement personnel" },
  { keywords: ["comics", "graphic novel", "bande dessinée", "manga", "comic"], slug: "bande-dessinee", label: "Bande dessinée" },
  { keywords: ["juvenile fiction", "juvenile literature", "children", "jeunesse", "young adult", "teen", "middle grade"], slug: "jeunesse", label: "Jeunesse" },
  { keywords: ["drama", "théâtre", "theatre"], slug: "theatre", label: "Théâtre" },
  { keywords: ["poetry", "poésie", "poesie", "poems"], slug: "poesie", label: "Poésie" },
  { keywords: ["philosophy", "philosophie", "éthique", "ethics"], slug: "philosophie", label: "Philosophie" },
  { keywords: ["psychology", "psychologie", "psychanalyse", "psychiatry"], slug: "psychologie", label: "Psychologie" },
  { keywords: ["natural science", "popular science", "physics", "biology", "chemistry", "mathematics", "astronomie", "astronomy", "sciences naturelles"], slug: "sciences", label: "Sciences" },
  { keywords: ["cooking", "food", "cuisine", "gastronomy", "gastronomie", "recettes"], slug: "cuisine", label: "Cuisine" },
  { keywords: ["travel", "voyage", "geography", "géographie", "récit de voyage"], slug: "voyage", label: "Voyage" },
  { keywords: ["art", "photography", "photographie", "painting", "architecture", "design"], slug: "art", label: "Art" },
  { keywords: ["humor", "humour", "comedy", "satire"], slug: "humour", label: "Humour" },
  { keywords: ["politics", "politique", "political science", "géopolitique", "geopolitics"], slug: "politique", label: "Politique" },
  { keywords: ["economics", "économie", "business", "finance", "entrepreneurship", "management"], slug: "economie", label: "Économie" },
  // "roman" is the broadest catch-all — must stay last so specific genres match first
  { keywords: ["literary fiction", "literary collections", "literature", "fiction", "roman", "littérature"], slug: "roman", label: "Roman" },
]

// Descriptions are prose: only words that can't mean anything else in a blurb. ("histoire" means
// "story", "art" and "voyage" are everyday words, "fantastique" means "amazing"…)
const DESCRIPTION_KEYWORDS: Record<string, string[]> = {
  "science-fiction": ["science-fiction", "science fiction", "dystopie", "dystopique"],
  fantastique: ["fantasy", "heroic fantasy", "dark fantasy"],
  policier: ["polar", "roman policier", "policier", "enquête policière"],
  thriller: ["thriller", "suspense"],
  romance: ["romance", "feel-good", "comédie romantique"],
  "roman-historique": ["roman historique", "fresque historique"],
  biographie: ["biographie", "autobiographie"],
}

const ROMAN: Genre = { slug: "roman", label: "Roman" }

const FORMAT_SLUGS = new Set(["roman", "bande-dessinee", "poesie", "theatre"])

const patternCache = new Map<string, RegExp>()

/** Whole-word match, accent-aware (\b only knows ASCII letters). */
function hasKeyword(text: string, keyword: string): boolean {
  let re = patternCache.get(keyword)
  if (!re) {
    const prefix = keyword.endsWith("*")
    const escaped = keyword.replace(/\*$/, "").replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
    re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}${prefix ? "" : "(?:s|x)?(?![\\p{L}\\p{N}])"}`, "u")
    patternCache.set(keyword, re)
  }
  return re.test(text)
}

export function mapCategoriesToGenres(categories: string[]): Genre[] {
  const matched = new Map<string, Genre>()
  for (const cat of categories) {
    const lower = cat.toLowerCase()
    for (const genre of GENRE_MAP) {
      if (genre.keywords.some((kw) => hasKeyword(lower, kw)) && !matched.has(genre.slug)) {
        matched.set(genre.slug, { slug: genre.slug, label: genre.label })
        break
      }
    }
  }
  // A crime novel's "Fiction / Thrillers" maps to Thriller only: it's still a novel
  const isAdultFiction = categories.some((c) => /^fiction\b/i.test(c))
  if (isAdultFiction && !matched.has("bande-dessinee") && !matched.has("roman")) {
    matched.set("roman", ROMAN)
  }
  return Array.from(matched.values())
}

function mapDescriptionToGenres(description: string | null): Genre[] {
  if (!description) return []
  const lower = description.toLowerCase()
  return GENRE_MAP.filter((g) => DESCRIPTION_KEYWORDS[g.slug]?.some((kw) => hasKeyword(lower, kw))).map(
    ({ slug, label }) => ({ slug, label })
  )
}

/** Genres for a book: from its categories, plus its description when they give no thematic genre. */
export function detectGenres(categories: string[], description: string | null): Genre[] {
  const genres = mapCategoriesToGenres(categories)
  if (genres.some((g) => !FORMAT_SLUGS.has(g.slug))) return genres
  const known = new Set(genres.map((g) => g.slug))
  return [...genres, ...mapDescriptionToGenres(description).filter((g) => !known.has(g.slug))]
}
