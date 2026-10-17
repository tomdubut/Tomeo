"use server"

import { submitContentReport } from "@/lib/reports"
import { revalidatePath, updateTag } from "next/cache"
import { after } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getGoogleBookById, normaliseVolume } from "@/lib/api/google-books"
import { enrichFromOpenLibrary, getOpenLibraryCover } from "@/lib/api/openlibrary"
import { cleanDescription, normalisePublisherName, parseSeriesFromTitle } from "@/lib/utils/bookText"
import { largerGoogleCover } from "@/lib/api/googleCover"
import { detectGenres } from "@/lib/books/genres"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GOOGLE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

function assertBookId(id: string) {
  if (!UUID_RE.test(id)) throw new Error("Invalid book ID")
}

function assertGoogleBooksId(id: string) {
  if (!GOOGLE_ID_RE.test(id)) throw new Error("Invalid Google Books ID")
}

/** Reuses a publisher whatever the case of its stored name ("ALBIN MICHEL" = "Albin Michel"). */
async function findOrCreatePublisher(admin: ReturnType<typeof createAdminClient>, rawName: string): Promise<string | null> {
  const name = normalisePublisherName(rawName)
  const { data: existing } = await admin
    .from("publishers")
    .select("id")
    .ilike("name", name.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle()
  if (existing) return existing.id
  const { data: created } = await admin
    .from("publishers")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single()
  return created?.id ?? null
}

export async function importBook(googleBooksId: string): Promise<{ id: string }> {
  assertGoogleBooksId(googleBooksId)

  const authClient = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, { data: existing }] = await Promise.all([
    authClient.auth.getUser(),
    admin.from("books").select("id").eq("google_books_id", googleBooksId).maybeSingle(),
  ])
  if (!user) throw new Error("Not authenticated")
  if (existing) return { id: existing.id }

  // Retry once on transient Google API errors (not on "this volume doesn't exist")
  let volume
  try {
    volume = await getGoogleBookById(googleBooksId)
  } catch (err) {
    if (isGoogleNotFound(err)) throw err
    await new Promise((r) => setTimeout(r, 1000))
    volume = await getGoogleBookById(googleBooksId)
  }

  // Guard: some volumes returned by search have no title when fetched individually
  if (!volume.volumeInfo?.title) {
    throw new Error(`Volume ${googleBooksId} has no title`)
  }

  const normalised = normaliseVolume(volume)

  const titleSeries = parseSeriesFromTitle(normalised.title)

  // These three lookups are independent: run them together
  const [byIsbn, publisherId, storedSeriesName] = await Promise.all([
    // Check by ISBN as fallback to avoid duplicates if book was imported from a different source
    normalised.isbn_13
      ? admin.from("books").select("id").eq("isbn_13", normalised.isbn_13).maybeSingle().then((r) => r.data)
      : null,
    normalised.publisher ? findOrCreatePublisher(admin, normalised.publisher) : null,
    // Reuse the spelling already stored ("Le Pays des Contes" vs "Le pays des contes")
    // so every volume of a series groups together. ilike without wildcards = case-insensitive equality.
    titleSeries.series_name
      ? admin
          .from("books")
          .select("series_name")
          .ilike("series_name", titleSeries.series_name.replace(/[\\%_]/g, (c) => `\\${c}`))
          .limit(1)
          .maybeSingle()
          .then((r) => (r.data?.series_name as string | undefined) ?? null)
      : null,
  ])
  if (byIsbn) return { id: byIsbn.id }
  if (storedSeriesName) titleSeries.series_name = storedSeriesName
  const { data: book, error } = await admin
    .from("books")
    .insert({
      title: normalised.title,
      subtitle: normalised.subtitle,
      description: cleanDescription(normalised.description),
      language: normalised.language,
      page_count: normalised.page_count,
      published_date: normalised.published_date,
      cover_url: normalised.cover_url,
      isbn_10: normalised.isbn_10,
      isbn_13: normalised.isbn_13,
      google_books_id: normalised.google_books_id,
      publisher_id: publisherId,
      series_name: titleSeries.series_name,
      series_position: titleSeries.series_position,
    })
    .select("id")
    .single()

  // Imported by someone else in the meantime (double click, two tabs): use their row
  if (error?.code === "23505") {
    const { data: raced } = await admin
      .from("books")
      .select("id")
      .or(`google_books_id.eq.${googleBooksId}${normalised.isbn_13 ? `,isbn_13.eq.${normalised.isbn_13}` : ""}`)
      .limit(1)
      .maybeSingle()
    if (raced) return { id: raced.id }
  }

  if (error || !book) {
    console.error(`[importBook] DB insert failed for "${normalised.title}" (${googleBooksId}):`, error?.message, error?.details)
    throw new Error(`Failed to import book: ${error?.message}`)
  }

  // Authors in parallel (display_order keeps their order)
  await Promise.all(normalised.authors.map(async (name, i) => {
    const parts = name.trim().split(" ")
    const sort_name =
      parts.length > 1 ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}` : name

    const { data: author } = await admin
      .from("authors")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ name, sort_name }, { onConflict: "name" } as any) // Supabase types don't expose onConflict for this table
      .select("id")
      .single()

    if (author) {
      await admin.from("book_authors").upsert(
        { book_id: book.id, author_id: author.id, role: "author", display_order: i },
        { onConflict: "book_id,author_id,role" }
      )
    }
  }))

  // Enrich after the response is sent — never blocks the import.
  // (Updates must be awaited: Supabase queries only run when awaited.)
  const isbn = normalised.isbn_13 ?? normalised.isbn_10
  after(async () => {
    try {
      const [enrichment, olCover, googleLarge] = await Promise.all([
        isbn ? enrichFromOpenLibrary(isbn) : null,
        isbn ? getOpenLibraryCover(isbn) : null,
        largerGoogleCover(normalised.cover_url),
      ])
      // Only edition-level data is trusted. Open Library's work first_publish_date is
      // often a reprint year (Othello → 2006) and its "series" is often a publisher
      // collection ("A Black cat book"), so neither is stored.
      const patch: Record<string, unknown> = {}
      if (enrichment?.edition_format) patch.edition_format = enrichment.edition_format
      // Cover: Google's larger version of the same image when verified, else Open Library's
      const cover = googleLarge ?? olCover
      if (cover) patch.cover_url = cover
      if (Object.keys(patch).length > 0) {
        const { error: patchError } = await admin.from("books").update(patch).eq("id", book.id)
        if (patchError) console.error("[importBook] enrichment patch failed:", patchError.message)
      }
    } catch (err) {
      console.error("[importBook] enrichment failed:", err)
    }
  })

  // Save genres — falls back to the description when categories give no thematic genre
  const genres = detectGenres(normalised.categories, normalised.description)
  await Promise.all(genres.map(async (genre) => {
    const { data: genreRow } = await admin
      .from("genres")
      .upsert({ slug: genre.slug, label: genre.label }, { onConflict: "slug" })
      .select("id")
      .single()
    if (genreRow) {
      await admin.from("book_genres").upsert(
        { book_id: book.id, genre_id: genreRow.id },
        { onConflict: "book_id,genre_id" }
      )
    }
  }))

  updateTag("books")
  return { id: book.id }
}

/** Google answered "no such volume" (vs. a temporary error worth retrying). */
function isGoogleNotFound(err: unknown) {
  return err instanceof Error && /Google Books API error: (400|404)\b/.test(err.message)
}

/**
 * Import for the /books/preview page. Returns the failure kind instead of throwing: in production,
 * errors thrown by server actions reach the browser without their message.
 */
export async function importBookFromPreview(
  googleBooksId: string
): Promise<{ id: string } | { error: "not_found" | "not_authenticated" | "failed" }> {
  try {
    return await importBook(googleBooksId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === "Not authenticated") return { error: "not_authenticated" }
    if (isGoogleNotFound(err) || message === "Invalid Google Books ID" || message.endsWith("has no title")) {
      return { error: "not_found" }
    }
    console.error(`[importBookFromPreview] ${googleBooksId}:`, message)
    return { error: "failed" }
  }
}

export async function importAndSetStatus(
  googleBooksId: string,
  status: "want_to_read" | "currently_reading" | "read",
  finishedAt?: string | null
): Promise<{ id: string }> {
  const { id } = await importBook(googleBooksId)
  await setReadingStatus(id, status, finishedAt)
  return { id }
}

export async function setReadingStatus(
  bookId: string,
  status: "want_to_read" | "currently_reading" | "read" | null,
  finishedAt?: string | null  // YYYY-MM-DD, only relevant for "read"
) {
  assertBookId(bookId)
  if (finishedAt != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(finishedAt)) throw new Error("Format de date invalide.")
    if (finishedAt > new Date().toISOString().slice(0, 10)) throw new Error("La date ne peut pas être dans le futur.")
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (status === null) {
    await supabase
      .from("user_books")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
    revalidatePath(`/books/${bookId}`)
    return
  }

  const today = new Date().toISOString().slice(0, 10)

  // Keep dates consistent: a book being read has no finish date, and a finish
  // date can't precede the start date. started_at is set automatically when the
  // user clicks "En cours", so it's the one dropped when they disagree.
  let dates: { started_at?: string | null; finished_at?: string | null } = {}
  if (status === "currently_reading") {
    dates = { started_at: today, finished_at: null }
  } else if (status === "read") {
    const finished = finishedAt ?? today
    const { data: current } = await supabase
      .from("user_books")
      .select("started_at")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .maybeSingle()
    dates = { finished_at: finished, ...(current?.started_at && current.started_at > finished ? { started_at: null } : {}) }
  }

  await supabase.from("user_books").upsert(
    { user_id: user.id, book_id: bookId, status, ...dates },
    { onConflict: "user_id,book_id" }
  )

  revalidatePath(`/books/${bookId}`)
}

export async function saveReview(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const bookId = formData.get("book_id") as string
  assertBookId(bookId)
  const body = (formData.get("body") as string).trim()
  const score = parseFloat((formData.get("score") ?? "") as string)
  const isSpoiler = formData.get("is_spoiler") === "on"
  const isPrivate = formData.get("is_private") === "on"

  if (!body || body.length < 10) {
    throw new Error("La critique doit contenir au moins 10 caractères.")
  }

  // Upsert rating only if score provided
  if (!isNaN(score) && score >= 1 && score <= 10) {
    const { error: ratingError } = await supabase.from("ratings").upsert(
      { user_id: user.id, book_id: bookId, score },
      { onConflict: "user_id,book_id" }
    )
    if (ratingError) throw new Error("Impossible d'enregistrer la note.")
  }

  const { error: reviewError } = await supabase.from("reviews").upsert(
    { user_id: user.id, book_id: bookId, body, is_spoiler: isSpoiler, is_private: isPrivate },
    { onConflict: "user_id,book_id" }
  )
  if (reviewError) throw new Error("Impossible d'enregistrer la critique.")

  updateTag(`reviews-${bookId}`)
  revalidatePath(`/books/${bookId}`)
}

export async function deleteReview(bookId: string) {
  assertBookId(bookId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("reviews").delete().eq("user_id", user.id).eq("book_id", bookId)
  await supabase.from("ratings").delete().eq("user_id", user.id).eq("book_id", bookId)

  updateTag(`reviews-${bookId}`)
  revalidatePath(`/books/${bookId}`)
}

export async function saveRatingOnly(bookId: string, score: number) {
  assertBookId(bookId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase.from("ratings").upsert(
    { user_id: user.id, book_id: bookId, score },
    { onConflict: "user_id,book_id" }
  )
  if (error) {
    console.error("saveRatingOnly error:", error)
    throw new Error("Impossible d'enregistrer la note.")
  }

  updateTag(`book-${bookId}`)
  revalidatePath(`/books/${bookId}`)
}

export async function deleteRating(bookId: string) {
  assertBookId(bookId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("ratings").delete().eq("user_id", user.id).eq("book_id", bookId)
  updateTag(`book-${bookId}`)
  revalidatePath(`/books/${bookId}`)
}

export async function saveQuickReview(bookId: string, score: number | null, body: string | null, isSpoiler = false, isPrivate = false) {
  assertBookId(bookId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (score && score >= 1 && score <= 10) {
    await supabase.from("ratings").upsert(
      { user_id: user.id, book_id: bookId, score },
      { onConflict: "user_id,book_id" }
    )
  }
  if (body && body.trim().length >= 10) {
    await supabase.from("reviews").upsert(
      { user_id: user.id, book_id: bookId, body: body.trim(), is_spoiler: isSpoiler, is_private: isPrivate },
      { onConflict: "user_id,book_id" }
    )
  }
  updateTag(`reviews-${bookId}`)
  revalidatePath(`/books/${bookId}`)
}

export async function updateReadingProgress(bookId: string, currentPage: number) {
  assertBookId(bookId)
  if (!Number.isInteger(currentPage) || currentPage < 0) throw new Error("Invalid page number")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase
    .from("user_books")
    .update({ current_page: currentPage })
    .eq("user_id", user.id)
    .eq("book_id", bookId)

  revalidatePath(`/books/${bookId}`)
}

export async function submitBookReport(bookId: string, reason: string, note: string | null) {
  assertBookId(bookId)
  await submitContentReport({ content_type: "book", book_id: bookId }, reason, note)
}
