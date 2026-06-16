#!/usr/bin/env npx ts-node --esm
/**
 * retag-genres.ts
 *
 * Re-fetches Google Books categories for every book in the DB and re-runs
 * genre mapping. Safe to run multiple times (upserts only, no deletes of
 * manually assigned tags).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GOOGLE_BOOKS_API_KEY=... \
 *   npx ts-node --esm scripts/retag-genres.ts
 *
 * Or with a local .env.local:
 *   npx dotenv -e .env.local -- npx ts-node --esm scripts/retag-genres.ts
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? ""

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── Genre map (must match actions.ts) ────────────────────────────────────────

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

async function fetchCategories(googleId: string): Promise<string[]> {
  const params = new URLSearchParams(GOOGLE_KEY ? { key: GOOGLE_KEY } : {})
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${googleId}?${params}`)
  if (!res.ok) throw new Error(`Google Books ${res.status} for ${googleId}`)
  const data = await res.json()
  return data.volumeInfo?.categories ?? []
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { data: books, error } = await admin
    .from("books")
    .select("id, title, google_books_id")
    .not("google_books_id", "is", null)

  if (error) throw error
  console.log(`Found ${books!.length} books to process\n`)

  let tagged = 0
  let skipped = 0

  for (const book of books!) {
    process.stdout.write(`[${book.title}] `)

    let categories: string[]
    try {
      categories = await fetchCategories(book.google_books_id)
      await sleep(200) // stay well under Google's rate limit
    } catch (e) {
      console.log(`⚠ fetch failed: ${(e as Error).message}`)
      skipped++
      continue
    }

    if (categories.length === 0) {
      console.log("no categories from Google Books")
      skipped++
      continue
    }

    const genres = mapCategoriesToGenres(categories)
    if (genres.length === 0) {
      console.log(`no match for: ${categories.join(", ")}`)
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

    console.log(`✓ ${genres.map((g) => g.slug).join(", ")}`)
    tagged++
  }

  console.log(`\nDone. Tagged: ${tagged}, skipped: ${skipped}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
