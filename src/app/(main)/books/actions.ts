"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getGoogleBookById, normaliseVolume } from "@/lib/api/google-books"

/**
 * Upsert a Google Books volume into our local books table.
 * Returns the local book UUID so we can redirect to /books/[id].
 * Uses the admin client for catalog writes (bypasses RLS — safe, server-only).
 */
export async function importBook(googleBooksId: string): Promise<{ id: string }> {
  const admin = createAdminClient()

  // Check if already imported
  const { data: existing } = await admin
    .from("books")
    .select("id")
    .eq("google_books_id", googleBooksId)
    .single()

  if (existing) return { id: existing.id }

  // Fetch from Google Books and normalise
  const volume = await getGoogleBookById(googleBooksId)
  const normalised = normaliseVolume(volume)

  // Upsert publisher
  let publisherId: string | null = null
  if (normalised.publisher) {
    const { data: pub } = await admin
      .from("publishers")
      .upsert({ name: normalised.publisher }, { onConflict: "name" })
      .select("id")
      .single()
    publisherId = pub?.id ?? null
  }

  // Insert book
  const { data: book, error } = await admin
    .from("books")
    .insert({
      title: normalised.title,
      subtitle: normalised.subtitle,
      description: normalised.description,
      language: normalised.language,
      page_count: normalised.page_count,
      published_date: normalised.published_date,
      cover_url: normalised.cover_url,
      isbn_10: normalised.isbn_10,
      isbn_13: normalised.isbn_13,
      google_books_id: normalised.google_books_id,
      publisher_id: publisherId,
    })
    .select("id")
    .single()

  if (error || !book) throw new Error(`Failed to import book: ${error?.message}`)

  // Upsert authors and link them
  for (let i = 0; i < normalised.authors.length; i++) {
    const name = normalised.authors[i]
    const parts = name.trim().split(" ")
    const sort_name =
      parts.length > 1 ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}` : name

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

  return { id: book.id }
}

/**
 * Set or update a user's reading status for a book.
 */
export async function setReadingStatus(
  bookId: string,
  status: "want_to_read" | "currently_reading" | "read" | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (status === null) {
    await supabase
      .from("user_books")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
    return
  }

  await supabase.from("user_books").upsert(
    {
      user_id: user.id,
      book_id: bookId,
      status,
      ...(status === "currently_reading"
        ? { started_at: new Date().toISOString().slice(0, 10) }
        : {}),
      ...(status === "read"
        ? { finished_at: new Date().toISOString().slice(0, 10) }
        : {}),
    },
    { onConflict: "user_id,book_id" }
  )
}
