const BASE_URL = "https://www.googleapis.com/books/v1"
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? ""

export interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    pageCount?: number
    categories?: string[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    language?: string
  }
}

export interface GoogleBooksSearchResult {
  totalItems: number
  items?: GoogleBooksVolume[]
}

export async function searchGoogleBooks(
  query: string,
  options: { maxResults?: number; startIndex?: number; langRestrict?: string } = {}
): Promise<GoogleBooksSearchResult> {
  const { maxResults = 20, startIndex = 0, langRestrict } = options

  // Prefix with intitle: unless the query already uses field qualifiers or looks like an ISBN
  const isISBN = /^\d[\d-]{8,}$/.test(query.trim())
  const hasQualifier = /^(intitle:|inauthor:|isbn:)/i.test(query.trim())
  const q = (!isISBN && !hasQualifier) ? `intitle:${query}` : query

  const params = new URLSearchParams({
    q,
    maxResults: String(maxResults),
    startIndex: String(startIndex),
    printType: "books",
    orderBy: "relevance",
    ...(langRestrict ? { langRestrict } : {}),
    ...(API_KEY ? { key: API_KEY } : {}),
  })

  const res = await fetch(`${BASE_URL}/volumes?${params}`, {
    next: { revalidate: 300 },
  })

  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`)
  return res.json()
}

export async function getGoogleBookById(googleId: string): Promise<GoogleBooksVolume> {
  const params = new URLSearchParams({
    ...(API_KEY ? { key: API_KEY } : {}),
  })
  const res = await fetch(`${BASE_URL}/volumes/${googleId}?${params}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`)
  return res.json()
}

// Removes duplicate Google Books entries that share the same ISBN-13 (Google often
// indexes the same edition multiple times). Prefers the entry with a cover, then the
// one with the longer description.
export function dedupByIsbn<T extends { isbn_13: string | null; cover_url: string | null; description: string | null }>(
  books: T[]
): T[] {
  const seenIsbn = new Map<string, number>()
  const out: T[] = []

  for (const book of books) {
    if (!book.isbn_13) {
      out.push(book)
      continue
    }

    const existingIdx = seenIsbn.get(book.isbn_13)
    if (existingIdx === undefined) {
      seenIsbn.set(book.isbn_13, out.length)
      out.push(book)
      continue
    }

    const existing = out[existingIdx]
    const existingScore = (existing.cover_url ? 2 : 0) + (existing.description?.length ?? 0)
    const currentScore = (book.cover_url ? 2 : 0) + (book.description?.length ?? 0)
    if (currentScore > existingScore) out[existingIdx] = book
  }

  return out
}

// Google Books publishedDate can be "1999", "1999-06", or "1999-06-15"
// Postgres DATE requires YYYY-MM-DD
function normaliseDateString(d: string): string | null {
  if (/^\d{4}$/.test(d)) return `${d}-01-01`
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  return null
}

// Normalise a Google Books volume into the shape our DB expects
export function normaliseVolume(vol: GoogleBooksVolume) {
  const info = vol.volumeInfo
  const isbn13 = info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? null
  const isbn10 = info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ?? null

  // Use a larger cover by swapping zoom param
  const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null
  const cover_url = rawCover
    ? rawCover.replace("http://", "https://").replace("&zoom=1", "&zoom=2")
    : null

  return {
    google_books_id: vol.id,
    title: info.title,
    subtitle: info.subtitle ?? null,
    description: info.description ?? null,
    language: info.language ?? "fr",
    page_count: info.pageCount ?? null,
    published_date: info.publishedDate ? normaliseDateString(info.publishedDate) : null,
    cover_url,
    isbn_10: isbn10,
    isbn_13: isbn13,
    authors: info.authors ?? [],
    publisher: info.publisher ?? null,
    categories: info.categories ?? [],
  }
}
