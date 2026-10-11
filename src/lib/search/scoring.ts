// Log-scale popularity: 10k ratings ≈ 1.0, 1M ratings ≈ 2.0
function popularity(ratingsCount: number): number {
  if (ratingsCount <= 0) return 0
  return Math.log10(ratingsCount) / 4
}

const ACADEMIC_CATEGORIES = new Set([
  "literary criticism", "literary collections", "criticism", "essays",
  "study aids", "reference", "research", "bibliography",
])

function isAcademic(categories: string[]): boolean {
  return categories.some((c) => ACADEMIC_CATEGORIES.has(c.toLowerCase()))
}

// Strip accents, articles, punctuation — normalise for comparison
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(le|la|les|un|une|des|l|d|the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Levenshtein edit distance (capped at maxDist for performance)
function editDistance(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i
    for (let j = 1; j <= n; j++) {
      const val = a[i - 1] === b[j - 1] ? dp[j - 1] : 1 + Math.min(dp[j - 1], dp[j], prev)
      dp[j - 1] = prev
      prev = val
    }
    dp[n] = prev
  }
  return dp[n]
}

// Fuzzy word match: exact, substring, or 1-edit-distance typo tolerance
function fuzzyWordMatch(qWord: string, target: string): boolean {
  if (target.includes(qWord)) return true
  // For short words skip fuzzy (too many false positives)
  if (qWord.length <= 3) return false
  const words = target.split(" ")
  return words.some((w) => editDistance(qWord, w, 1) <= 1)
}

// Score how well the query matches the title + authors (0–5 range)
export function relevanceScore(query: string, title: string, authors: string[]): number {
  const q = normalise(query)
  const t = normalise(title)
  const qWords = q.split(" ").filter((w) => w.length > 1)
  if (qWords.length === 0) return 0

  // Exact or near-exact title match
  if (t === q) return 5
  if (t.startsWith(q) && q.length > 3) return 3.5
  if (q.startsWith(t) && t.length > 3) return 3

  // Per-word fuzzy matching against title
  const matchedWords = qWords.filter((w) => fuzzyWordMatch(w, t))
  const wordScore = (matchedWords.length / qWords.length) * 2.5

  // Author matching bonus
  const authorStr = normalise(authors.join(" "))
  const authorBonus = qWords.some((w) => w.length > 2 && fuzzyWordMatch(w, authorStr)) ? 0.5 : 0

  return wordScore + authorBonus
}

export type Scoreable = {
  title: string
  authors?: string[]
  cover_url: string | null
  ratings_count: number
  average_rating: number | null
  language?: string
  categories?: string[]
  page_count?: number | null
  query?: string
}

// Boost well-known books with many ratings; slight penalty for missing cover; soft French priority.
// Academic/essay books are pushed down unless they have many ratings (making them well-known works).
// Spam ebook aggregators are penalized via long-title and bulk-omnibus signals.
// When a query is provided, title/author relevance is the dominant factor.
export function scoreBook(book: Scoreable): number {
  const titleWords = book.title.trim().split(/\s+/).length
  const longTitlePenalty = titleWords > 10 ? -1.5 : titleWords > 7 ? -0.5 : 0
  const bulkPenalty = (book.page_count ?? 0) > 800 && book.ratings_count === 0 ? -2 : 0
  const relevance = book.query
    ? relevanceScore(book.query, book.title, book.authors ?? []) * 2
    : 0

  return (
    relevance +
    popularity(book.ratings_count) * 2 +
    ((book.average_rating ?? 0) / 5) * 0.5 +
    (book.cover_url ? 0.5 : -3) +
    (book.language === "fr" ? 0.5 : 0) +
    (isAcademic(book.categories ?? []) ? -1 : 0) +
    longTitlePenalty +
    bulkPenalty
  )
}

