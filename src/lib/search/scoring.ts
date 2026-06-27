/**
 * Multi-factor scoring for book search results.
 *
 * Factors (in descending weight):
 *   1. Spin-off penalty  — coloring books, journals, activity books rank last
 *   2. Relevance         — how well the title/author match the query words
 *   3. Popularity        — Google ratings count (log-scaled)
 *   4. Quality           — Google average rating
 *   5. Cover presence    — books without a cover pushed down
 */

// Keywords that indicate a derivative/spin-off work.
// Only applied when the query itself doesn't contain one of these words
// (so searching "Harry Potter coloriage" still returns coloring books).
const SPINOFF_PATTERNS = [
  /\bcoloriage\b/i,
  /\bcoloring\b/i,
  /\bà colorier\b/i,
  /\bactivity book\b/i,
  /\bcahier d.activit/i,
  /\bworkbook\b/i,
  /\bjournal\b/i,
  /\bcarnet\b/i,
  /\bpuzzle\b/i,
  /\btrivia\b/i,
  /\bquiz book\b/i,
  /\bcookbook\b/i,
]

function isSpinoff(title: string, queryWords: string[]): boolean {
  // Don't penalize if the user explicitly searched for this type
  const queryStr = queryWords.join(" ")
  return SPINOFF_PATTERNS.some(
    (re) => re.test(title) && !re.test(queryStr)
  )
}

function relevance(title: string, authors: string[], queryWords: string[]): number {
  if (queryWords.length === 0) return 1
  const t = title.toLowerCase()
  const a = authors.join(" ").toLowerCase()
  const titleWords = t.split(/\s+/)
  const titleMatched = queryWords.filter((w) => titleWords.some((tw) => tw.includes(w))).length
  const authorMatched = queryWords.filter((w) => a.includes(w)).length
  return (titleMatched / Math.max(titleWords.length, 1)) + authorMatched * 0.8
}

// Log-scale popularity: 10k ratings ≈ 1.0, 1M ratings ≈ 2.0
function popularity(ratingsCount: number): number {
  if (ratingsCount <= 0) return 0
  return Math.log10(ratingsCount) / 4
}

export type Scoreable = {
  title: string
  authors: string[]
  cover_url: string | null
  ratings_count: number
  average_rating: number | null
}

export function scoreBook(book: Scoreable, queryWords: string[]): number {
  if (isSpinoff(book.title, queryWords)) return -10

  return (
    relevance(book.title, book.authors, queryWords) * 3 +
    popularity(book.ratings_count) * 2 +
    ((book.average_rating ?? 0) / 5) * 0.5 +
    (book.cover_url ? 0.5 : -1)
  )
}

export function extractQueryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
}
