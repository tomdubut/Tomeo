import { NextRequest, NextResponse } from "next/server"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"

const FR_THRESHOLD = 3

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json([])

  const isISBN = /^\d[\d-]{8,}$/.test(q)
  const queryWords = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2)

  function isRelevant(title: string) {
    if (isISBN || queryWords.length === 0) return true
    const t = title.toLowerCase()
    return queryWords.some((w) => t.includes(w))
  }

  function relevanceScore(title: string) {
    if (isISBN || queryWords.length === 0) return 1
    const titleWords = title.toLowerCase().split(/\s+/)
    const matched = queryWords.filter((w) => titleWords.some((t) => t.includes(w))).length
    return matched / titleWords.length
  }

  try {
    const data = await searchGoogleBooks(q, { maxResults: 20, langRestrict: "fr" })
    const frResults = dedupByIsbn(
      (data.items ?? [])
        .map(normaliseVolume)
        .filter((b) => b.language === "fr" && b.title && isRelevant(b.title))
    )
      .sort((a, b) => relevanceScore(b.title) - relevanceScore(a.title))
      .slice(0, 8)

    let results = frResults

    if (frResults.length < FR_THRESHOLD) {
      const fallbackData = await searchGoogleBooks(q, { maxResults: 20 })
      const frIds = new Set(frResults.map((b) => b.google_books_id))
      const fallback = dedupByIsbn(
        (fallbackData.items ?? [])
          .map(normaliseVolume)
          .filter((b) => b.language !== "fr" && b.title && !frIds.has(b.google_books_id) && isRelevant(b.title))
      )
        .sort((a, b) => relevanceScore(b.title) - relevanceScore(a.title))
        .slice(0, 8 - frResults.length)
      results = [...frResults, ...fallback]
    }

    return NextResponse.json(
      results.map((b) => ({
        google_books_id: b.google_books_id,
        title: b.title,
        authors: b.authors,
        cover_url: b.cover_url,
        language: b.language,
      }))
    )
  } catch {
    return NextResponse.json([])
  }
}
