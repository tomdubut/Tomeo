import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? ""
  if (q.length < 2 || !userId) return NextResponse.json({ books: [] })

  const supabase = await createClient()

  const { data } = await supabase
    .from("user_books")
    .select("book:books(id, title, cover_url, book_authors(role, display_order, author:authors(name)))")
    .eq("user_id", userId)
    .ilike("book.title", `%${q}%`)
    .limit(20)

  const books = (data ?? [])
    .map((ub: any) => ub.book)
    .filter(Boolean)
    .map((b: any) => ({
      id: b.id,
      title: b.title,
      cover_url: b.cover_url,
      authors: (b.book_authors ?? [])
        .filter((ba: any) => ba.role === "author")
        .sort((a: any, z: any) => a.display_order - z.display_order)
        .map((ba: any) => ba.author?.[0]?.name)
        .filter(Boolean),
    }))

  return NextResponse.json({ books })
}
