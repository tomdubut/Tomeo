import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getGoogleBookById, normaliseVolume } from "@/lib/api/google-books"

const GENRE_MAP: Array<{ keywords: string[]; slug: string; label: string }> = [
  { keywords: ["science fiction", "science-fiction", "sci-fi"], slug: "science-fiction", label: "Science-Fiction" },
  { keywords: ["fantasy", "fantastique", "heroic fantasy"], slug: "fantastique", label: "Fantastique" },
  { keywords: ["mystery", "detective", "policier", "crime"], slug: "policier", label: "Policier" },
  { keywords: ["thriller", "suspense"], slug: "thriller", label: "Thriller" },
  { keywords: ["horror", "horreur"], slug: "horreur", label: "Horreur" },
  { keywords: ["romance", "love stories"], slug: "romance", label: "Romance" },
  { keywords: ["historical fiction", "roman historique"], slug: "roman-historique", label: "Roman historique" },
  { keywords: ["biography", "autobiograph", "biographie"], slug: "biographie", label: "Biographie" },
  { keywords: ["history", "histoire"], slug: "histoire", label: "Histoire" },
  { keywords: ["self-help", "personal development", "développement personnel"], slug: "developpement-personnel", label: "Développement personnel" },
  { keywords: ["comics", "graphic novel", "bande dessinée", "manga"], slug: "bande-dessinee", label: "Bande dessinée" },
  { keywords: ["juvenile fiction", "children", "jeunesse", "young adult", "teen"], slug: "jeunesse", label: "Jeunesse" },
  { keywords: ["poetry", "poésie", "poesie"], slug: "poesie", label: "Poésie" },
  { keywords: ["philosophy", "philosophie"], slug: "philosophie", label: "Philosophie" },
  { keywords: ["psychology", "psychologie"], slug: "psychologie", label: "Psychologie" },
  { keywords: ["science", "sciences"], slug: "sciences", label: "Sciences" },
  { keywords: ["cooking", "food", "cuisine", "gastronomy"], slug: "cuisine", label: "Cuisine" },
  { keywords: ["travel", "voyage", "geography"], slug: "voyage", label: "Voyage" },
  { keywords: ["art", "photography", "painting", "architecture"], slug: "art", label: "Art" },
  { keywords: ["humor", "humour", "comedy"], slug: "humour", label: "Humour" },
  { keywords: ["politics", "politique", "political science"], slug: "politique", label: "Politique" },
  { keywords: ["economics", "économie", "business", "finance"], slug: "economie", label: "Économie" },
  { keywords: ["literary fiction", "literary collections", "literature"], slug: "litterature", label: "Littérature" },
  { keywords: ["fiction"], slug: "roman", label: "Roman" },
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

export async function GET() {
  const admin = createAdminClient()

  // Find books that have no book_genres rows
  const { data: allBooks } = await admin
    .from("books")
    .select("id, google_books_id")
    .not("google_books_id", "is", null)

  if (!allBooks?.length) {
    return NextResponse.json({ message: "No books found", tagged: 0, skipped: 0, failed: 0 })
  }

  const { data: taggedRows } = await admin
    .from("book_genres")
    .select("book_id")
  const alreadyTagged = new Set((taggedRows ?? []).map((r) => r.book_id))

  const toProcess = allBooks.filter((b) => !alreadyTagged.has(b.id))

  let tagged = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const book of toProcess) {
    try {
      const volume = await getGoogleBookById(book.google_books_id!)
      const categories = volume.volumeInfo.categories ?? []
      const genres = mapCategoriesToGenres(categories)

      if (!genres.length) {
        skipped++
        continue
      }

      for (const genre of genres) {
        const { data: genreRow } = await admin
          .from("genres")
          .upsert({ slug: genre.slug, label: genre.label }, { onConflict: "slug" })
          .select("id")
          .single()
        if (genreRow) {
          await admin
            .from("book_genres")
            .upsert({ book_id: book.id, genre_id: genreRow.id }, { onConflict: "book_id,genre_id" })
        }
      }

      tagged++

      // Avoid hitting Google Books rate limit
      await new Promise((r) => setTimeout(r, 200))
    } catch (e) {
      failed++
      errors.push(`${book.google_books_id}: ${e instanceof Error ? e.message : "unknown error"}`)
    }
  }

  return NextResponse.json({
    message: "Backfill complete",
    total: toProcess.length,
    tagged,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  })
}
