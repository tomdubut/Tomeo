import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ""
const FORMAT_SLUGS = new Set(["roman", "bande-dessinee", "poesie"])

// Lists books that have no thematic genre tag (format-only or completely untagged).
// Visit /api/admin/books-without-genre?secret=... to get a JSON list to fix manually
// in Supabase's Table Editor (book_genres table).
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret")
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: books, error } = await admin.from("books").select("id, title")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: bgRows, error: bgError } = await admin
    .from("book_genres")
    .select("book_id, genres(slug)")
  if (bgError) return NextResponse.json({ error: bgError.message }, { status: 500 })

  const genreSlugsByBook = new Map<string, string[]>()
  for (const row of bgRows ?? []) {
    const slug = (row as any).genres?.slug
    if (!slug) continue
    const list = genreSlugsByBook.get(row.book_id) ?? []
    list.push(slug)
    genreSlugsByBook.set(row.book_id, list)
  }

  const missing = (books ?? [])
    .filter((b) => {
      const slugs = genreSlugsByBook.get(b.id) ?? []
      return !slugs.some((s) => !FORMAT_SLUGS.has(s))
    })
    .map((b) => ({
      id: b.id,
      title: b.title,
      currentTags: genreSlugsByBook.get(b.id) ?? [],
    }))

  return NextResponse.json({ count: missing.length, books: missing })
}
