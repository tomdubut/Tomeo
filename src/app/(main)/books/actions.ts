"use server"

import { revalidatePath, updateTag } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getGoogleBookById, normaliseVolume } from "@/lib/api/google-books"
import { enrichFromOpenLibrary, getOpenLibraryCover } from "@/lib/api/openlibrary"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GOOGLE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

function assertBookId(id: string) {
  if (!UUID_RE.test(id)) throw new Error("Invalid book ID")
}

function assertGoogleBooksId(id: string) {
  if (!GOOGLE_ID_RE.test(id)) throw new Error("Invalid Google Books ID")
}

// Maps Google Books category keywords (lowercase) to our genre slugs + French labels.
// Order matters: more specific entries must come before broader ones (e.g. "science fiction"
// before "science", "historical fiction" before "fiction").
const GENRE_MAP: Array<{ keywords: string[]; slug: string; label: string }> = [
  { keywords: ["science fiction", "science-fiction", "sci-fi", "sf "], slug: "science-fiction", label: "Science-Fiction" },
  { keywords: ["fantasy", "fantastique", "heroic fantasy", "high fantasy", "dark fantasy"], slug: "fantastique", label: "Fantastique" },
  { keywords: ["mystery", "detective", "policier", "crime fiction", "whodunit", "noir"], slug: "policier", label: "Policier" },
  { keywords: ["thriller", "suspense", "espionnage"], slug: "thriller", label: "Thriller" },
  { keywords: ["horror", "horreur", "épouvante"], slug: "horreur", label: "Horreur" },
  { keywords: ["romance", "love stories", "sentimentale", "feel-good"], slug: "romance", label: "Romance" },
  { keywords: ["historical fiction", "roman historique", "histoire et fiction"], slug: "roman-historique", label: "Roman historique" },
  { keywords: ["biography", "autobiograph", "biographie", "mémoires", "memoir"], slug: "biographie", label: "Biographie" },
  { keywords: ["history", "histoire", "historical"], slug: "histoire", label: "Histoire" },
  { keywords: ["self-help", "personal development", "développement personnel", "well-being", "bien-être", "motivation"], slug: "developpement-personnel", label: "Développement personnel" },
  { keywords: ["comics", "graphic novel", "bande dessinée", "manga", "comic"], slug: "bande-dessinee", label: "Bande dessinée" },
  { keywords: ["juvenile fiction", "juvenile literature", "children", "jeunesse", "young adult", "teen", "middle grade"], slug: "jeunesse", label: "Jeunesse" },
  { keywords: ["poetry", "poésie", "poesie", "poems"], slug: "poesie", label: "Poésie" },
  { keywords: ["philosophy", "philosophie", "éthique", "ethics"], slug: "philosophie", label: "Philosophie" },
  { keywords: ["psychology", "psychologie", "psychanalyse", "psychiatry"], slug: "psychologie", label: "Psychologie" },
  { keywords: ["natural science", "popular science", "physics", "biology", "chemistry", "mathematics", "astronomie", "astronomy", "sciences naturelles"], slug: "sciences", label: "Sciences" },
  { keywords: ["cooking", "food", "cuisine", "gastronomy", "gastronomie", "recettes"], slug: "cuisine", label: "Cuisine" },
  { keywords: ["travel", "voyage", "geography", "géographie", "récit de voyage"], slug: "voyage", label: "Voyage" },
  { keywords: ["art", "photography", "photographie", "painting", "architecture", "design"], slug: "art", label: "Art" },
  { keywords: ["humor", "humour", "comedy", "satire"], slug: "humour", label: "Humour" },
  { keywords: ["politics", "politique", "political science", "géopolitique", "geopolitics"], slug: "politique", label: "Politique" },
  { keywords: ["economics", "économie", "business", "finance", "entrepreneurship", "management"], slug: "economie", label: "Économie" },
  // "roman" is the broadest catch-all — must stay last so specific genres match first
  { keywords: ["literary fiction", "literary collections", "literature", "fiction", "roman", "littérature"], slug: "roman", label: "Roman" },
]

const FORMAT_SLUGS = new Set(["roman", "bande-dessinee", "poesie"])

function mapCategoriesToGenres(categories: string[]): Array<{ slug: string; label: string }> {
  const matched = new Map<string, { slug: string; label: string }>()
  for (const cat of categories) {
    const lower = cat.toLowerCase()
    for (const genre of GENRE_MAP) {
      if (genre.keywords.some((kw) => lower.includes(kw)) && !matched.has(genre.slug)) {
        matched.set(genre.slug, { slug: genre.slug, label: genre.label })
        break
      }
    }
  }
  return Array.from(matched.values())
}

// Fallback: if categories produced no thematic genre (only format, or nothing),
// scan the book description for genre keywords as a second pass.
function mapDescriptionToGenres(description: string | null): Array<{ slug: string; label: string }> {
  if (!description) return []
  const lower = description.toLowerCase()
  const matched = new Map<string, { slug: string; label: string }>()
  for (const genre of GENRE_MAP) {
    if (FORMAT_SLUGS.has(genre.slug)) continue
    if (genre.keywords.some((kw) => lower.includes(kw))) {
      matched.set(genre.slug, { slug: genre.slug, label: genre.label })
    }
  }
  return Array.from(matched.values())
}

export async function importBook(googleBooksId: string): Promise<{ id: string }> {
  assertGoogleBooksId(googleBooksId)
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("books")
    .select("id")
    .eq("google_books_id", googleBooksId)
    .single()

  if (existing) return { id: existing.id }

  // Retry once on transient Google API errors
  let volume
  try {
    volume = await getGoogleBookById(googleBooksId)
  } catch {
    await new Promise((r) => setTimeout(r, 1000))
    volume = await getGoogleBookById(googleBooksId)
  }

  // Guard: some volumes returned by search have no title when fetched individually
  if (!volume.volumeInfo?.title) {
    throw new Error(`Volume ${googleBooksId} has no title`)
  }

  const normalised = normaliseVolume(volume)

  // Check by ISBN as fallback to avoid duplicates if book was imported from a different source
  if (normalised.isbn_13) {
    const { data: byIsbn } = await admin
      .from("books")
      .select("id")
      .eq("isbn_13", normalised.isbn_13)
      .single()
    if (byIsbn) return { id: byIsbn.id }
  }

  let publisherId: string | null = null
  if (normalised.publisher) {
    const { data: pub } = await admin
      .from("publishers")
      .upsert({ name: normalised.publisher }, { onConflict: "name" })
      .select("id")
      .single()
    publisherId = pub?.id ?? null
  }

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

  if (error || !book) {
    console.error(`[importBook] DB insert failed for "${normalised.title}" (${googleBooksId}):`, error?.message, error?.details)
    throw new Error(`Failed to import book: ${error?.message}`)
  }

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

  // Enrich with Open Library metadata + cover — fire-and-forget, never blocks the import
  if (normalised.isbn_13 || normalised.isbn_10) {
    const isbn = (normalised.isbn_13 ?? normalised.isbn_10)!
    Promise.all([enrichFromOpenLibrary(isbn), getOpenLibraryCover(isbn)]).then(([enrichment, olCover]) => {
      const patch: Record<string, unknown> = {}
      if (enrichment) {
        patch.first_published_date = enrichment.first_published_date
        patch.edition_format = enrichment.edition_format
        patch.series_name = enrichment.series_name
        patch.series_position = enrichment.series_position
      }
      if (olCover) patch.cover_url = olCover
      if (Object.keys(patch).length > 0) {
        admin.from("books").update(patch).eq("id", book.id)
      }
    }).catch(() => {})
  }

  // Save genres — fall back to scanning the description if categories gave no thematic genre
  let genres = mapCategoriesToGenres(normalised.categories)
  if (!genres.some((g) => !FORMAT_SLUGS.has(g.slug))) {
    genres = [...genres, ...mapDescriptionToGenres(normalised.description)]
  }
  for (const genre of genres) {
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
  }

  updateTag("books")
  return { id: book.id }
}

export async function setReadingStatus(
  bookId: string,
  status: "want_to_read" | "currently_reading" | "read" | null,
  finishedAt?: string | null  // YYYY-MM-DD, only relevant for "read"
) {
  assertBookId(bookId)
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

  await supabase.from("user_books").upsert(
    {
      user_id: user.id,
      book_id: bookId,
      status,
      ...(status === "currently_reading" ? { started_at: today } : {}),
      ...(status === "read" ? { finished_at: finishedAt ?? today } : {}),
    },
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
  const score = parseFloat(formData.get("score") as string)
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

  await supabase.from("ratings").upsert(
    { user_id: user.id, book_id: bookId, score },
    { onConflict: "user_id,book_id" }
  )

  revalidatePath(`/books/${bookId}`)
}

export async function deleteRating(bookId: string) {
  assertBookId(bookId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("ratings").delete().eq("user_id", user.id).eq("book_id", bookId)
  revalidatePath(`/books/${bookId}`)
}

export async function saveQuickReview(bookId: string, score: number | null, body: string | null) {
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
  if (body && body.trim().length >= 1) {
    await supabase.from("reviews").upsert(
      { user_id: user.id, book_id: bookId, body: body.trim(), is_spoiler: false, is_private: false },
      { onConflict: "user_id,book_id" }
    )
  }
  updateTag(`reviews-${bookId}`)
  revalidatePath(`/books/${bookId}`)
}

export async function updateReadingProgress(bookId: string, currentPage: number) {
  assertBookId(bookId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase
    .from("user_books")
    .update({ current_page: currentPage })
    .eq("user_id", user.id)
    .eq("book_id", bookId)
}
