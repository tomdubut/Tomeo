import { NextRequest, NextResponse } from "next/server"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"
import { searchLocalBooks } from "@/lib/supabase/queries"
import { scoreBook, isRelevant, extractQueryWords } from "@/lib/search/scoring"
import { createClient } from "@/lib/supabase/server"

const FR_THRESHOLD = 3
const PAGE_SIZE = 20

async function fetchAndScore(
  titleQuery: string,
  authorQuery: string,
  isISBN: boolean,
  queryWords: string[],
  options: { maxResults: number; startIndex: number; langRestrict?: string }
) {
  const [titleData, authorData] = await Promise.all([
    searchGoogleBooks(titleQuery, options),
    isISBN ? Promise.resolve({ totalItems: 0, items: [] }) : searchGoogleBooks(authorQuery, options),
  ])

  const books = dedupByIsbn(
    [...(titleData.items ?? []), ...(authorData.items ?? [])].map(normaliseVolume)
  )

  return {
    books,
    totalItems: titleData.totalItems,
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10))
  if (q.length < 2) return NextResponse.json({ results: [], hasMore: false })

  const isISBN = /^\d[\d-]{8,}$/.test(q)
  const queryWords = extractQueryWords(q)
  const titleQuery = isISBN ? q : `intitle:${q}`
  const authorQuery = isISBN ? q : `inauthor:${q}`

  try {
    // Fetch user library for status badges
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const libraryStatusByGoogleId = new Map<string, string>()
    const libraryStatusById = new Map<string, string>()
    if (user) {
      const { data: userBooks } = await supabase
        .from("user_books")
        .select("status, book:books(id, google_books_id)")
        .eq("user_id", user.id)
      for (const ub of userBooks ?? []) {
        const book = ub.book as unknown as { id: string; google_books_id: string | null } | null
        if (!book) continue
        libraryStatusById.set(book.id, ub.status)
        if (book.google_books_id) libraryStatusByGoogleId.set(book.google_books_id, ub.status)
      }
    }

    const [{ books: frBooks, totalItems }, localBooks] = await Promise.all([
      fetchAndScore(titleQuery, authorQuery, isISBN, queryWords, {
        maxResults: PAGE_SIZE,
        startIndex: offset,
        langRestrict: "fr",
      }),
      offset === 0 ? searchLocalBooks(q, 6) : Promise.resolve([]),
    ])

    let googleResults = frBooks
      .filter((b) => b.language === "fr" && b.title && isRelevant(b, queryWords))
      .sort((a, b) => scoreBook(b, queryWords) - scoreBook(a, queryWords))
      .slice(0, PAGE_SIZE)

    // Fall back to all languages when French results are sparse
    if (googleResults.length < FR_THRESHOLD) {
      const { books: allBooks } = await fetchAndScore(titleQuery, authorQuery, isISBN, queryWords, {
        maxResults: PAGE_SIZE,
        startIndex: offset,
      })
      const frIds = new Set(googleResults.map((b) => b.google_books_id))
      const fallback = allBooks
        .filter((b) => b.language !== "fr" && b.title && b.cover_url !== null && !frIds.has(b.google_books_id) && isRelevant(b, queryWords))
        .sort((a, b) => scoreBook(b, queryWords) - scoreBook(a, queryWords))
        .slice(0, PAGE_SIZE - googleResults.length)
      googleResults = [...googleResults, ...fallback]
    }

    // Remove Google results that duplicate a Tomeo DB book
    const normalizeTitle = (t: string) =>
      t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
    const localTitles = new Set(localBooks.map((b) => normalizeTitle(b.title)))
    const filteredGoogle = googleResults.filter((b) => !localTitles.has(normalizeTitle(b.title)))

    // For books with no cover, try the fife URL. Drop books where no cover resolves.
    const resolvedGoogle = (await Promise.all(
      filteredGoogle.map(async (b) => {
        if (b.cover_url) return b
        const fifeUrl = `https://books.google.com/books/publisher/content/images/frontcover/${b.google_books_id}?fife=w400-h600`
        try {
          const res = await fetch(fifeUrl, { method: "HEAD", signal: AbortSignal.timeout(1200) })
          const length = parseInt(res.headers.get("content-length") ?? "0", 10)
          if (length > 10_000) return { ...b, cover_url: fifeUrl }
        } catch {}
        return null
      })
    )).filter((b): b is NonNullable<typeof b> => b !== null)

    const results = [
      ...localBooks.map((b) => ({ ...b, source: "tomeo" as const, libraryStatus: libraryStatusById.get(b.id) ?? null })),
      ...resolvedGoogle.map((b) => ({
        google_books_id: b.google_books_id,
        title: b.title,
        authors: b.authors,
        cover_url: b.cover_url,
        source: "google" as const,
        libraryStatus: libraryStatusByGoogleId.get(b.google_books_id) ?? null,
      })),
    ]

    return NextResponse.json({ results, hasMore: googleResults.length === PAGE_SIZE })
  } catch (err) {
    console.error("[search] Unexpected error:", err)
    return NextResponse.json({ results: [], hasMore: false })
  }
}
