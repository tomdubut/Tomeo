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
    ratingsCount?: number
    averageRating?: number
  }
}

export interface GoogleBooksSearchResult {
  totalItems: number
  items?: GoogleBooksVolume[]
}

// Google Books API rejects queries with apostrophes (returns 503).
// Replace them with spaces and strip accents so "l'étranger" → "l etranger".
function sanitizeQuery(str: string): string {
  return str
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[''']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function searchGoogleBooks(
  query: string,
  options: { maxResults?: number; startIndex?: number; langRestrict?: string } = {}
): Promise<GoogleBooksSearchResult> {
  const { maxResults = 20, startIndex = 0, langRestrict } = options
  const params = new URLSearchParams({
    q: sanitizeQuery(query),
    maxResults: String(maxResults),
    startIndex: String(startIndex),
    printType: "books",
    orderBy: "relevance",
    ...(langRestrict ? { langRestrict } : {}),
    ...(API_KEY ? { key: API_KEY } : {}),
  })

  const baseUrl = `${BASE_URL}/volumes?${params}`

  // Never cache — Next.js was caching 503 responses and serving them for 5 minutes,
  // causing every subsequent search to fail until the cache expired.
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = attempt === 0 ? baseUrl : `${baseUrl}&_r=${attempt}`
    const fetchOpts = { cache: "no-store" as const }
    const res = await fetch(url, fetchOpts)
    if (res.ok) return res.json()
    const debugUrl = url.replace(/key=[^&]+/, "key=REDACTED")
    console.error(`[google-books] attempt=${attempt} status=${res.status} url=${debugUrl}`)
    if (res.status !== 429 && res.status !== 503) {
      throw new Error(`Google Books API error: ${res.status}`)
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
  }
  throw new Error("Google Books API error: 503")
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

function titleKey(title: string, authors: string[]): string {
  const t = title
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip accents
    .toLowerCase()
    .replace(/['''\-:]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    // strip leading articles only
    .replace(/^(le|la|les|l|un|une|des|the|a|an|de|du)\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
  // Use only last name of first author to handle "Victor Hugo" vs "M. Victor Hugo"
  const authorParts = (authors[0] ?? "").toLowerCase().trim().split(/\s+/)
  const a = authorParts[authorParts.length - 1] ?? ""
  return `${t}|${a}`
}

function bestEntry<T extends { cover_url: string | null; description: string | null }>(a: T, b: T): T {
  const score = (x: T) => (x.cover_url ? 10 : 0) + (x.description?.length ?? 0)
  return score(b) > score(a) ? b : a
}

// Removes duplicate Google Books entries by ISBN-13 first, then by normalised title+author.
// Prefers the entry with a cover, then the one with the longer description.
export function dedupByIsbn<T extends { isbn_13: string | null; cover_url: string | null; description: string | null; title: string; authors: string[] }>(
  books: T[]
): T[] {
  // Pass 1: dedup by ISBN-13
  const seenIsbn = new Map<string, number>()
  const pass1: T[] = []

  for (const book of books) {
    if (!book.isbn_13) {
      pass1.push(book)
      continue
    }
    const idx = seenIsbn.get(book.isbn_13)
    if (idx === undefined) {
      seenIsbn.set(book.isbn_13, pass1.length)
      pass1.push(book)
    } else {
      pass1[idx] = bestEntry(pass1[idx], book)
    }
  }

  // Pass 2: dedup by normalised title + first author
  const seenTitle = new Map<string, number>()
  const out: T[] = []

  for (const book of pass1) {
    const key = titleKey(book.title, book.authors)
    const idx = seenTitle.get(key)
    if (idx === undefined) {
      seenTitle.set(key, out.length)
      out.push(book)
    } else {
      out[idx] = bestEntry(out[idx], book)
    }
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

  const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null
  const cover_url = rawCover ? rawCover.replace("http://", "https://") : null

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
    ratings_count: info.ratingsCount ?? 0,
    average_rating: info.averageRating ?? null,
  }
}
