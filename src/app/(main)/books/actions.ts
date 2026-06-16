"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getGoogleBookById, normaliseVolume } from "@/lib/api/google-books"

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

export async function importBook(googleBooksId: string): Promise<{ id: string }> {
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

  // Save genres
  const genres = mapCategoriesToGenres(normalised.categories)
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

  return { id: book.id }
}

export async function setReadingStatus(
  bookId: string,
  status: "want_to_read" | "currently_reading" | "read" | null,
  finishedAt?: string | null  // YYYY-MM-DD, only relevant for "read"
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
  const body = (formData.get("body") as string).trim()
  const score = parseFloat(formData.get("score") as string)
  const isSpoiler = formData.get("is_spoiler") === "on"
  const isPrivate = formData.get("is_private") === "on"

  if (!body || body.length < 10) {
    throw new Error("La critique doit contenir au moins 10 caractères.")
  }
  if (isNaN(score) || score < 1 || score > 10) {
    throw new Error("La note doit être entre 1 et 10.")
  }

  // Upsert rating
  await supabase.from("ratings").upsert(
    { user_id: user.id, book_id: bookId, score },
    { onConflict: "user_id,book_id" }
  )

  // Upsert review
  await supabase.from("reviews").upsert(
    { user_id: user.id, book_id: bookId, body, is_spoiler: isSpoiler, is_private: isPrivate },
    { onConflict: "user_id,book_id" }
  )

  revalidatePath(`/books/${bookId}`)
}

export async function deleteReview(bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("reviews").delete().eq("user_id", user.id).eq("book_id", bookId)
  await supabase.from("ratings").delete().eq("user_id", user.id).eq("book_id", bookId)

  revalidatePath(`/books/${bookId}`)
}

export async function saveRatingOnly(bookId: string, score: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("ratings").upsert(
    { user_id: user.id, book_id: bookId, score },
    { onConflict: "user_id,book_id" }
  )

  revalidatePath(`/books/${bookId}`)
}
