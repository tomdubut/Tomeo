import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"
import { NextRequest } from "next/server"

const FR_THRESHOLD = 3

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()

  if (!q) return Response.json({ results: [], fallback: [] })

  try {
    const data = await searchGoogleBooks(q, { maxResults: 12, langRestrict: "fr" })
    const results = dedupByIsbn((data.items ?? []).map(normaliseVolume).filter((b) => b.language === "fr"))

    let fallback: typeof results = []
    if (results.length < FR_THRESHOLD) {
      const fallbackData = await searchGoogleBooks(q, { maxResults: 12 })
      const frIds = new Set(results.map((b) => b.google_books_id))
      fallback = dedupByIsbn(
        (fallbackData.items ?? []).map(normaliseVolume).filter((b) => b.language !== "fr" && !frIds.has(b.google_books_id))
      ).slice(0, 8)
    }

    return Response.json({ results, fallback })
  } catch (e) {
    return Response.json({ results: [], fallback: [], error: e instanceof Error ? e.message : "error" }, { status: 500 })
  }
}
