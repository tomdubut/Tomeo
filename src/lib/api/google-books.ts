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

  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
    startIndex: String(startIndex),
    printType: "books",
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
    published_date: info.publishedDate ? info.publishedDate.slice(0, 10) : null,
    cover_url,
    isbn_10: isbn10,
    isbn_13: isbn13,
    authors: info.authors ?? [],
    publisher: info.publisher ?? null,
    categories: info.categories ?? [],
  }
}
