import { NextRequest, NextResponse } from "next/server"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"
import { searchLocalBooks } from "@/lib/supabase/queries"

const FR_THRESHOLD = 3
const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10))
  if (q.length < 2) return NextResponse.json([])

  const isISBN = /^\d[\d-]{8,}$/.test(q)
  const queryWords = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2)

  function isRelevant(title: string, authors: string[]) {
    if (isISBN || queryWords.length === 0) return true
    const t = title.toLowerCase()
    const a = authors.join(" ").toLowerCase()
    return queryWords.some((w) => t.includes(w) || a.includes(w))
  }

  function relevanceScore(title: string, authors: string[]) {
    if (isISBN || queryWords.length === 0) return 1
    const titleWords = title.toLowerCase().split(/\s+/)
    const authorStr = authors.join(" ").toLowerCase()
    const titleMatched = queryWords.filter((w) => titleWords.some((t) => t.includes(w))).length
    const authorMatched = queryWords.filter((w) => authorStr.includes(w)).length
    return (titleMatched / Math.max(titleWords.length, 1)) + authorMatched * 0.8
  }

  try {
    const titleQuery = isISBN ? q : `intitle:${q}`
    const authorQuery = isISBN ? q : `inauthor:${q}`

    const [titleData, authorData, localBooks] = await Promise.all([
      searchGoogleBooks(titleQuery, { maxResults: PAGE_SIZE, startIndex: offset, langRestrict: "fr" }),
      isISBN ? Promise.resolve({ totalItems: 0, items: [] }) : searchGoogleBooks(authorQuery, { maxResults: PAGE_SIZE, startIndex: offset, langRestrict: "fr" }),
      offset === 0 ? searchLocalBooks(q, 6) : Promise.resolve([]),
    ])

    const frResults = dedupByIsbn(
      [...(titleData.items ?? []), ...(authorData.items ?? [])]
        .map(normaliseVolume)
        .filter((b) => b.language === "fr" && b.title && isRelevant(b.title, b.authors))
    )
      .sort((a, b) => relevanceScore(b.title, b.authors) - relevanceScore(a.title, a.authors))
      .slice(0, PAGE_SIZE)

    let googleResults = frResults

    if (frResults.length < FR_THRESHOLD) {
      const [titleFallback, authorFallback] = await Promise.all([
        searchGoogleBooks(titleQuery, { maxResults: PAGE_SIZE, startIndex: offset }),
        isISBN ? Promise.resolve({ totalItems: 0, items: [] }) : searchGoogleBooks(authorQuery, { maxResults: PAGE_SIZE, startIndex: offset }),
      ])
      const frIds = new Set(frResults.map((b) => b.google_books_id))
      const fallback = dedupByIsbn(
        [...(titleFallback.items ?? []), ...(authorFallback.items ?? [])]
          .map(normaliseVolume)
          .filter((b) => b.language !== "fr" && b.title && !frIds.has(b.google_books_id) && isRelevant(b.title, b.authors))
      )
        .sort((a, b) => relevanceScore(b.title, b.authors) - relevanceScore(a.title, a.authors))
        .slice(0, PAGE_SIZE - frResults.length)
      googleResults = [...frResults, ...fallback]
    }

    const localTitles = new Set(localBooks.map((b) => b.title.toLowerCase()))
    const filteredGoogle = googleResults.filter((b) => !localTitles.has(b.title.toLowerCase()))

    const results = [
      ...localBooks.map((b) => ({ ...b, source: "tomeo" as const })),
      ...filteredGoogle.map((b) => ({
        google_books_id: b.google_books_id,
        title: b.title,
        authors: b.authors,
        cover_url: b.cover_url,
        source: "google" as const,
      })),
    ]

    return NextResponse.json({ results, hasMore: googleResults.length === PAGE_SIZE })
  } catch {
    return NextResponse.json({ results: [], hasMore: false })
  }
}
