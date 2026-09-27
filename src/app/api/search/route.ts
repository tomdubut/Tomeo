import { NextRequest, NextResponse } from "next/server"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn, GoogleBooksVolume } from "@/lib/api/google-books"
import { searchLocalBooks } from "@/lib/supabase/queries"
import { scoreBook } from "@/lib/search/scoring"
import { createClient } from "@/lib/supabase/server"
import { searchBnF } from "@/lib/api/bnf"
import { getOpenLibraryCover } from "@/lib/api/openlibrary"

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const type = req.nextUrl.searchParams.get("type") ?? "books"
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10))
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
      const { data } = await supabase
        .from("manga_series")
        .select("id, title_fr, author, cover_url")
        .ilike("title_fr", `%${q}%`)
        .order("title_fr")
        .limit(PAGE_SIZE)
      const results = (data ?? []).map((m) => ({
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

    const normalizeTitle = (t: string) =>
      t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()

    const [allData, frData, localBooks, bnfBooks] = await Promise.all([
      searchGoogleBooks(q, { maxResults: PAGE_SIZE, startIndex: offset }),
      offset === 0
        ? searchGoogleBooks(q, { maxResults: PAGE_SIZE, langRestrict: "fr" })
        : Promise.resolve({ totalItems: 0, items: [] as GoogleBooksVolume[] }),
      offset === 0 ? searchLocalBooks(q, 6) : Promise.resolve([]),
      offset === 0 ? searchBnF(q, 8).catch((e) => { console.error("[search/bnf] failed:", String(e)); return [] }) : Promise.resolve([]),
    ])

    console.log(`[search] bnfBooks=${bnfBooks.length} frData=${frData.items?.length ?? 0} allData=${allData.items?.length ?? 0}`)
    if (bnfBooks.length > 0) console.log("[search/bnf] titles:", bnfBooks.map(b => `${b.title} isbn=${b.isbn_13}`))

    const localTitles = new Set(localBooks.map((b) => normalizeTitle(b.title)))

    // Resolve covers for BnF results: Open Library by ISBN, then Google Books by ISBN as fallback
    const bnfNormalised = await Promise.all(
      bnfBooks.map(async (b) => {
        let cover_url: string | null = null
        if (b.isbn_13) {
          cover_url = await getOpenLibraryCover(b.isbn_13).catch(() => null)
          console.log(`[search/bnf] isbn=${b.isbn_13} ol_cover=${cover_url}`)
          if (!cover_url) {
            const gbResult = await searchGoogleBooks(`isbn:${b.isbn_13}`, { maxResults: 1 }).catch(() => null)
            const first = gbResult?.items?.[0]
            if (first) cover_url = normaliseVolume(first).cover_url
            console.log(`[search/bnf] isbn=${b.isbn_13} gb_cover=${cover_url}`)
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

    // BnF first so French editions win dedup when ISBN matches, then FR Google, then all Google
    const googleBooks = dedupByIsbn([
      ...bnfNormalised.filter((b) => b.cover_url !== null),
      ...(frData.items ?? []).map(normaliseVolume),
      ...(allData.items ?? []).map(normaliseVolume),
    ])
      .filter((b) => b.title && b.cover_url !== null && !localTitles.has(normalizeTitle(b.title)))
      .sort((a, b) => scoreBook(b) - scoreBook(a))

    const results = [
      ...localBooks.map((b) => ({ ...b, source: "tomeo" as const, libraryStatus: libraryStatusById.get(b.id) ?? null })),
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
