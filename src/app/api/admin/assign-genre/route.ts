import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ""

// Manually assign a genre/format tag to a book.
// Visit /api/admin/assign-genre?secret=...&book=<book_id>&slug=<genre_slug>
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret")
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bookId = req.nextUrl.searchParams.get("book")
  const slug = req.nextUrl.searchParams.get("slug")
  if (!bookId || !slug) {
    return NextResponse.json({ error: "Missing book or slug query param" }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: genreRow, error: genreError } = await admin
    .from("genres")
    .select("id, label")
    .eq("slug", slug)
    .single()

  if (genreError || !genreRow) {
    return NextResponse.json({ error: `Unknown genre slug: ${slug}` }, { status: 404 })
  }

  const { error: insertError } = await admin
    .from("book_genres")
    .upsert({ book_id: bookId, genre_id: genreRow.id }, { onConflict: "book_id,genre_id" })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ ok: true, book: bookId, assigned: { slug, label: genreRow.label } })
}
