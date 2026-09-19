import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json({ books: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ books: [] }, { status: 401 })

  const { data } = await supabase
    .from("user_books")
    .select("book:books(id, title, cover_url, book_authors(role, display_order, author:authors(name)))")
    .eq("user_id", user.id)

  const needle = q.toLowerCase()
  const books = (data ?? [])
    .map((ub: any) => ub.book)
    .filter((b: any) => b && b.title?.toLowerCase().includes(needle))
    .slice(0, 20)
    .map((b: any) => ({
      id: b.id,
      title: b.title,
      cover_url: b.cover_url,
      authors: (b.book_authors ?? [])
        .filter((ba: any) => ba.role === "author")
        .sort((a: any, z: any) => a.display_order - z.display_order)
        .map((ba: any) => ba.author?.name)
        .filter(Boolean),
    }))

  return NextResponse.json({ books })
}
