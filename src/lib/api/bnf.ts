const BNF_SRU = "https://catalogue.bnf.fr/api/SRU"

export interface BnFBook {
  title: string
  authors: string[]
  publisher: string | null
  isbn_13: string | null
  published_date: string | null
  language: "fr"
}

// Build a CQL query for BnF SRU. ISBN queries use bib.isbn; everything else
// uses bib.anywhere restricted to French-language records.
function buildCQL(query: string): string {
  const digits = query.replace(/[\s\-]/g, "")
  if (/^\d{13}$/.test(digits) || /^\d{10}$/.test(digits)) {
    return `bib.isbn any "${digits}"`
  }
  const sanitized = query
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[''']/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return `bib.anywhere any "${sanitized}" and dc.language any "fre"`
}

function extractText(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([^<]*)<`, "gi")
  let m
  while ((m = re.exec(xml)) !== null) {
    const val = m[1].trim()
    if (val) results.push(val)
  }
  return results
}

function parseRecords(xml: string): BnFBook[] {
  // Split on record boundaries
  const recordRe = /<srw:record>[\s\S]*?<\/srw:record>/g
  const books: BnFBook[] = []
  let m
  while ((m = recordRe.exec(xml)) !== null) {
    const rec = m[0]
    const titles = extractText(rec, "title")
    const title = titles[0]
    if (!title) continue

    const creators = extractText(rec, "creator")
    const publishers = extractText(rec, "publisher")
    const dates = extractText(rec, "date")
    const identifiers = extractText(rec, "identifier")

    // Find ISBN-13 among identifiers
    const isbn13 = identifiers.find((id) => /^97[89]\d{10}$/.test(id.replace(/[\s\-]/g, "")))
      ?.replace(/[\s\-]/g, "") ?? null

    // Normalize date to YYYY-MM-DD
    let published_date: string | null = null
    for (const d of dates) {
      if (/^\d{4}$/.test(d.trim())) { published_date = `${d.trim()}-01-01`; break }
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) { published_date = d.trim(); break }
    }

    books.push({
      title,
      authors: creators,
      publisher: publishers[0] ?? null,
      isbn_13: isbn13,
      published_date,
      language: "fr",
    })
  }
  return books
}

// Module-level cache — 5-minute TTL, same pattern as google-books.ts
const CACHE_TTL = 5 * 60 * 1000
const bnfCache = new Map<string, { data: BnFBook[]; expiresAt: number }>()

export async function searchBnF(query: string, maxResults = 8): Promise<BnFBook[]> {
  const cacheKey = `${query}|${maxResults}`
  const cached = bnfCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const params = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query: buildCQL(query),
    recordSchema: "dublincore",
    maximumRecords: String(maxResults),
  })

  try {
    const res = await fetch(`${BNF_SRU}?${params}`, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Tomesie/1.0" },
      cache: "no-store",
    })
    if (!res.ok) {
      console.error(`[bnf] status=${res.status}`)
      return []
    }
    const xml = await res.text()
    console.log("[bnf] raw xml (first 1000):", xml.slice(0, 1000))
    const data = parseRecords(xml)
    console.log("[bnf] parsed:", data.length, "records")
    bnfCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL })
    return data
  } catch (err) {
    console.error("[bnf] fetch error:", err)
    return []
  }
}
