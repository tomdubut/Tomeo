import { NextRequest, NextResponse } from "next/server"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json([])

  try {
    const data = await searchGoogleBooks(q, { maxResults: 20 })
    const results = dedupByIsbn(
      (data.items ?? []).map(normaliseVolume).filter((b) => b.title)
    )
      .slice(0, 8)
      .map((b) => ({
        google_books_id: b.google_books_id,
        title: b.title,
        authors: b.authors,
        cover_url: b.cover_url,
      }))

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}
