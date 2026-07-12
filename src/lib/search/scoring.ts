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

// Boost well-known books with many ratings; slight penalty for missing cover.
export function scoreBook(book: Scoreable): number {
  return (
    popularity(book.ratings_count) * 2 +
    ((book.average_rating ?? 0) / 5) * 0.5 +
    (book.cover_url ? 0.2 : -1)
  )
}

export function extractQueryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
}
