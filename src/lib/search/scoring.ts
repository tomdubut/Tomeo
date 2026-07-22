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

export type Scoreable = {
  title: string
  authors: string[]
  cover_url: string | null
  ratings_count: number
  average_rating: number | null
  language?: string
  categories?: string[]
}

// Boost well-known books with many ratings; slight penalty for missing cover; soft French priority.
// Academic/essay books are pushed down unless they have many ratings (making them well-known works).
export function scoreBook(book: Scoreable): number {
  return (
    popularity(book.ratings_count) * 2 +
    ((book.average_rating ?? 0) / 5) * 0.5 +
    (book.cover_url ? 0.2 : -1) +
    (book.language === "fr" ? 0.5 : 0) +
    (isAcademic(book.categories ?? []) ? -1 : 0)
  )
}

export function extractQueryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
}
