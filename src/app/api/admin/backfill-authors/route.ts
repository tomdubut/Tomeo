import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getGoogleBookById } from "@/lib/api/google-books"

export async function GET() {
  const admin = createAdminClient()

  const { data: books } = await admin
    .from("books")
    .select("id, google_books_id")
    .not("google_books_id", "is", null)

  if (!books?.length) return NextResponse.json({ message: "No books found", tagged: 0 })

  let tagged = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const book of books) {
    try {
      const volume = await getGoogleBookById(book.google_books_id!)
      const authorNames: string[] = volume.volumeInfo.authors ?? []

      if (!authorNames.length) { skipped++; continue }

      for (let i = 0; i < authorNames.length; i++) {
        const name = authorNames[i].trim()
        const parts = name.split(" ")
        const sort_name = parts.length > 1
          ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`
          : name

        const { data: author } = await admin
          .from("authors")
          .upsert({ name, sort_name }, { onConflict: "name" } as any)
          .select("id")
          .single()

        if (author) {
          await admin.from("book_authors").upsert(
            { book_id: book.id, author_id: author.id, role: "author", display_order: i },
            { onConflict: "book_id,author_id,role" }
          )
        }
      }

      tagged++
      await new Promise((r) => setTimeout(r, 200))
    } catch (e) {
      failed++
      errors.push(`${book.google_books_id}: ${e instanceof Error ? e.message : "unknown"}`)
    }
  }

  return NextResponse.json({ message: "Backfill complete", total: books.length, tagged, skipped, failed, errors: errors.slice(0, 20) })
}
