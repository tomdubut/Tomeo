const BASE_URL = "https://openlibrary.org"

export interface OpenLibraryEnrichment {
  first_published_date: string | null  // YYYY-MM-DD
  edition_format: string | null
  series_name: string | null
  series_position: number | null
}

// Normalise various publish date formats to YYYY-MM-DD
function normaliseDate(raw: string | undefined): string | null {
  if (!raw) return null
  // "1997" → "1997-01-01"
  if (/^\d{4}$/.test(raw.trim())) return `${raw.trim()}-01-01`
  // "June 26, 1997" or "October 1, 2001"
  const parsed = Date.parse(raw)
  if (!isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  return null
}

// Extract series name and position from an OL series array.
// OL stores series as strings like "Harry Potter" or "Harry Potter #3" or "Harry Potter, tome 3".
function parseSeries(seriesArr: string[] | undefined): { name: string | null; position: number | null } {
  if (!seriesArr?.length) return { name: null, position: null }
  const raw = seriesArr[0].trim()
  // Try to extract a trailing number: "#3", "tome 3", "vol. 3", ", 3"
  const match = raw.match(/(?:#|tome\s*|vol(?:ume)?\.?\s*|,\s*)(\d+(?:\.\d+)?)$/i)
  if (match) {
    return {
      name: raw.slice(0, match.index).replace(/[\s,]+$/, "").trim() || null,
      position: parseFloat(match[1]),
    }
  }
  return { name: raw || null, position: null }
}

// Normalise OL physical_format to a French label
function normaliseFormat(raw: string | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes("paperback") || lower.includes("mass market") || lower.includes("poche")) return "Poche"
  if (lower.includes("hardcover") || lower.includes("hardback") || lower.includes("relié")) return "Relié"
  if (lower.includes("ebook") || lower.includes("e-book") || lower.includes("digital") || lower.includes("kindle")) return "Ebook"
  if (lower.includes("audio")) return "Audiobook"
  if (lower.includes("graphic") || lower.includes("bd") || lower.includes("comics")) return "BD"
  // Return capitalised raw value as fallback
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export interface OpenLibraryBook {
  title: string
  authors: string[]
  cover_url: string | null
  isbn_13: string | null
  isbn_10: string | null
  published_date: string | null
}

const OL_USER_AGENT = "Tomesie/1.0 (contact@tomeo.app)"
const SEARCH_TIMEOUT = 5000

async function _searchOL(queryParams: Record<string, string>, limit: number): Promise<OpenLibraryBook[]> {
  try {
    const params = new URLSearchParams({
      ...queryParams,
      fields: "title,author_name,cover_i,isbn,first_publish_year",
      limit: String(limit),
    })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { "User-Agent": OL_USER_AGENT },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.docs ?? []).map((doc: any) => ({
      title: doc.title ?? "",
      authors: doc.author_name ?? [],
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
      isbn_13: (doc.isbn ?? []).find((i: string) => i.length === 13) ?? null,
      isbn_10: (doc.isbn ?? []).find((i: string) => i.length === 10) ?? null,
      published_date: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : null,
    }))
  } catch {
    return []
  }
}

// Search Open Library by title — returns books with the query in their title.
export async function searchOpenLibrary(query: string, limit = 20): Promise<OpenLibraryBook[]> {
  return _searchOL({ title: query }, limit)
}

// Fuzzy keyword search across OL title+author — tolerates plural/singular mismatches.
export async function searchOpenLibraryKeywords(query: string, limit = 10): Promise<OpenLibraryBook[]> {
  return _searchOL({ q: query }, limit)
}

// Returns a real Open Library cover URL for the given ISBN, or null if none exists.
// OL returns a 1×1 transparent GIF (~43 bytes) when no cover is available.
export async function getOpenLibraryCover(isbn: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": OL_USER_AGENT },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT),
    })
    if (!res.ok) return null
    const length = parseInt(res.headers.get("content-length") ?? "0", 10)
    return length > 1000 ? url : null
  } catch {
    return null
  }
}

// Fetch edition data by ISBN, then follow the work link for first_publish_date.
// Returns null if the ISBN isn't found on OL.
export async function enrichFromOpenLibrary(isbn: string): Promise<OpenLibraryEnrichment | null> {
  try {
    const editionRes = await fetch(`${BASE_URL}/isbn/${isbn}.json`, {
      headers: { "User-Agent": OL_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    })
    if (!editionRes.ok) return null
    const edition = await editionRes.json()

    const { name: series_name, position: series_position } = parseSeries(edition.series)
    const edition_format = normaliseFormat(edition.physical_format)

    // Follow the work link to get first_publish_date
    let first_published_date: string | null = null
    const workKey: string | undefined = edition.works?.[0]?.key
    if (workKey) {
      const workRes = await fetch(`${BASE_URL}${workKey}.json`, {
        headers: { "User-Agent": OL_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      })
      if (workRes.ok) {
        const work = await workRes.json()
        first_published_date = normaliseDate(work.first_publish_date)
      }
    }

    return { first_published_date, edition_format, series_name, series_position }
  } catch {
    return null
  }
}
