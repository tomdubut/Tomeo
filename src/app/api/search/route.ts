import { NextRequest, NextResponse } from "next/server"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn, GoogleBooksVolume } from "@/lib/api/google-books"
import { searchLocalBooks } from "@/lib/supabase/queries"
import { scoreBook, relevanceScore, normalise } from "@/lib/search/scoring"
import { createClient } from "@/lib/supabase/server"
import { searchManga } from "@/lib/supabase/searchManga"
import { searchBnF } from "@/lib/api/bnf"
import { getOpenLibraryCover, searchOpenLibrary, searchOpenLibraryKeywords, type OpenLibraryBook } from "@/lib/api/openlibrary"

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  // Bounded inputs: each request fans out to several external APIs
  const q = (req.nextUrl.searchParams.get("q")?.trim() ?? "").slice(0, 200)
  const type = req.nextUrl.searchParams.get("type") ?? "books"
  const offset = Math.min(200, Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0))
  if (q.length < 2) return NextResponse.json({ results: [], hasMore: false })

  if (type === "manga") {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const mangaStatusById = new Map<string, string>()
      if (user) {
        const { data: userManga } = await supabase
          .from("user_manga")
          .select("manga_id, status")
          .eq("user_id", user.id)
          .limit(1000)
        for (const um of userManga ?? []) mangaStatusById.set(um.manga_id, um.status)
      }
      const data = await searchManga(supabase, q, PAGE_SIZE)
      const results = data.map((m) => ({
        id: m.id,
        title: m.title_fr,
        authors: m.author ? [m.author] : [],
        cover_url: m.cover_url,
        source: "manga" as const,
        libraryStatus: mangaStatusById.get(m.id) ?? null,
      }))
      return NextResponse.json({ results, hasMore: false })
    } catch (err) {
      console.error("[search/manga]", err)
      return NextResponse.json({ results: [], hasMore: false })
    }
  }

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
        .limit(1000)
      for (const ub of userBooks ?? []) {
        const book = ub.book as unknown as { id: string; google_books_id: string | null } | null
        if (!book) continue
        libraryStatusById.set(book.id, ub.status)
        if (book.google_books_id) libraryStatusByGoogleId.set(book.google_books_id, ub.status)
      }
    }

    const normalizeTitle = (t: string) => normalise(t)

    // Toggle plural/singular on each word to catch "horizon perdu" ↔ "horizons perdus"
    const qVariant = q.trim().split(/\s+/).map(w => w.endsWith("s") ? w.slice(0, -1) : w + "s").join(" ")

    const [allData, frData, localBooks, bnfBooks, variantData, olBooks, olKeywordBooks] = await Promise.all([
      searchGoogleBooks(q, { maxResults: PAGE_SIZE, startIndex: offset }),
      offset === 0
        ? searchGoogleBooks(q, { maxResults: PAGE_SIZE, langRestrict: "fr" })
        : Promise.resolve({ totalItems: 0, items: [] as GoogleBooksVolume[] }),
      offset === 0 ? searchLocalBooks(q, 6) : Promise.resolve([]),
      offset === 0 ? searchBnF(q, 8).catch((e) => { console.error("[search/bnf] failed:", String(e)); return [] }) : Promise.resolve([]),
      offset === 0 ? searchGoogleBooks(qVariant, { maxResults: 10 }).catch(() => ({ totalItems: 0, items: [] as GoogleBooksVolume[] })) : Promise.resolve({ totalItems: 0, items: [] as GoogleBooksVolume[] }),
      offset === 0 ? searchOpenLibrary(q, 20).catch(() => [] as OpenLibraryBook[]) : Promise.resolve([] as OpenLibraryBook[]),
      offset === 0 ? searchOpenLibraryKeywords(q, 20).catch(() => [] as OpenLibraryBook[]) : Promise.resolve([] as OpenLibraryBook[]),
    ])

    const localTitles = new Set(localBooks.map((b) => normalizeTitle(b.title)))

    // Normalise OL results into the same shape as Google volumes
    const olNormalised = [...olBooks, ...olKeywordBooks]
      .filter((b) => b.title && !localTitles.has(normalizeTitle(b.title)))
      .filter((b) => !q || relevanceScore(q, b.title, b.authors) > 0)
      .map((b) => ({
        google_books_id: `ol-${b.isbn_13 ?? encodeURIComponent(b.title)}`,
        title: b.title,
        subtitle: null as string | null,
        description: null as string | null,
        language: undefined as string | undefined,
        page_count: null as number | null,
        published_date: b.published_date,
        cover_url: b.cover_url,
        isbn_10: b.isbn_10,
        isbn_13: b.isbn_13,
        authors: b.authors,
        publisher: null as string | null,
        categories: [] as string[],
        ratings_count: 0,
        average_rating: null as number | null,
      }))

    // Resolve covers for BnF results: Open Library by ISBN, then Google Books by ISBN as fallback
    const bnfNormalised = await Promise.all(
      bnfBooks.map(async (b) => {
        let cover_url: string | null = null
        if (b.isbn_13) {
          cover_url = await getOpenLibraryCover(b.isbn_13).catch(() => null)
          if (!cover_url) {
            const gbResult = await searchGoogleBooks(`isbn:${b.isbn_13}`, { maxResults: 1 }).catch(() => null)
            const first = gbResult?.items?.[0]
            if (first) cover_url = normaliseVolume(first).cover_url
          }
        }
        return {
          google_books_id: `bnf-${b.isbn_13 ?? encodeURIComponent(b.title)}`,
          title: b.title,
          subtitle: null,
          description: null,
          language: "fr" as const,
          page_count: null,
          published_date: b.published_date,
          cover_url,
          isbn_10: null,
          isbn_13: b.isbn_13,
          authors: b.authors,
          publisher: b.publisher,
          categories: [] as string[],
          ratings_count: 0,
          average_rating: null,
        }
      })
    )

    // BnF first so French editions win dedup when ISBN matches, then OL (title-specific), then Google
    const googleBooks = dedupByIsbn([
      ...bnfNormalised.filter((b) => b.cover_url !== null),
      ...olNormalised,
      ...(frData.items ?? []).map(normaliseVolume),
      ...(allData.items ?? []).map(normaliseVolume),
      ...(variantData.items ?? []).map(normaliseVolume),
    ])
      .filter((b) => b.title && b.cover_url !== null && !localTitles.has(normalizeTitle(b.title)))
      .filter((b) => !q || relevanceScore(q, b.title, b.authors ?? []) > 0)
      .sort((a, b) => scoreBook({ ...b, query: q }) - scoreBook({ ...a, query: q }))

    const filteredLocalBooks = q
      ? localBooks.filter((b) => relevanceScore(q, b.title, b.authors?.map((a: any) => a.name ?? a) ?? []) > 0)
      : localBooks

    const results = [
      ...filteredLocalBooks.map((b) => ({ ...b, source: "tomeo" as const, libraryStatus: libraryStatusById.get(b.id) ?? null })),
      ...googleBooks.map((b) => ({
        google_books_id: b.google_books_id,
        title: b.title,
        authors: b.authors,
        cover_url: b.cover_url,
        source: "google" as const,
        libraryStatus: libraryStatusByGoogleId.get(b.google_books_id) ?? null,
      })),
    ]

    return NextResponse.json({ results, hasMore: allData.totalItems > offset + PAGE_SIZE })
  } catch (err) {
    console.error("[search] Unexpected error:", err)
    return NextResponse.json({ results: [], hasMore: false })
  }
}
