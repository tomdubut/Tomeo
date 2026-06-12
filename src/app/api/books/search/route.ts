import { searchGoogleBooks, normaliseVolume } from "@/lib/api/google-books"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()

  if (!q) return Response.json({ results: [] })

  try {
    const data = await searchGoogleBooks(q, { maxResults: 8, langRestrict: "fr" })
    const results = (data.items ?? []).map(normaliseVolume)
    return Response.json({ results })
  } catch (e) {
    return Response.json({ results: [], error: e instanceof Error ? e.message : "error" }, { status: 500 })
  }
}
