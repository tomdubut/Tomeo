import { NextRequest, NextResponse } from "next/server"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"
import { searchLocalBooks } from "@/lib/supabase/queries"
import { scoreBook } from "@/lib/search/scoring"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10))
  if (q.length < 2) return NextResponse.json({ results: [], hasMore: false })

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

    const normalizeTitle = (t: string) =>
      t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()

    const [allData, localBooks] = await Promise.all([
      searchGoogleBooks(q, { maxResults: PAGE_SIZE, startIndex: offset }),
      offset === 0 ? searchLocalBooks(q, 6) : Promise.resolve([]),
    ])

    const localTitles = new Set(localBooks.map((b) => normalizeTitle(b.title)))
    const localGoogleIds = new Set(localBooks.map((b) => b.google_books_id).filter(Boolean))

    const googleBooks = dedupByIsbn((allData.items ?? []).map(normaliseVolume))
      .filter((b) => b.title && b.cover_url !== null
        && !localTitles.has(normalizeTitle(b.title))
        && !localGoogleIds.has(b.google_books_id))
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
