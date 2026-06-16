import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ""

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
  { keywords: ["literary fiction", "literary collections", "literature", "fiction", "roman", "littérature"], slug: "roman", label: "Roman" },
]

function mapCategoriesToGenres(categories: string[]) {
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

async function fetchCategories(googleId: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY ?? ""
  const params = new URLSearchParams(apiKey ? { key: apiKey } : {})
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${googleId}?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.volumeInfo?.categories ?? []
}

export async function GET(req: NextRequest) {
  // Simple secret-based protection
  const secret = req.nextUrl.searchParams.get("secret")
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: books, error } = await admin
    .from("books")
    .select("id, title, google_books_id")
    .not("google_books_id", "is", null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const log: string[] = []
  let tagged = 0
  let skipped = 0

  for (const book of books ?? []) {
    const categories = await fetchCategories(book.google_books_id)

    if (categories.length === 0) {
      log.push(`SKIP  ${book.title} — no categories from Google Books`)
      skipped++
      continue
    }

    const genres = mapCategoriesToGenres(categories)
    if (genres.length === 0) {
      log.push(`SKIP  ${book.title} — no match for: ${categories.join(", ")}`)
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

    log.push(`OK    ${book.title} → ${genres.map((g) => g.slug).join(", ")}`)
    tagged++

    // Small delay to stay under Google's rate limit
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json({ tagged, skipped, log })
}
