/**
 * Backfill Open Library enrichment for all existing books.
 *
 * Run with:
 *   npx tsx scripts/backfill-book-metadata.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local.
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { enrichFromOpenLibrary } from "../src/lib/api/openlibrary"

config({ path: ".env.local" })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BATCH_SIZE = 20
const DELAY_MS = 500  // be polite to OL's servers

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  // Fetch all books that have an ISBN and are missing at least one enriched field
  const { data: books, error } = await supabase
    .from("books")
    .select("id, isbn_13, isbn_10, title")
    .or("first_published_date.is.null,edition_format.is.null,series_name.is.null")
    .not("isbn_13", "is", null)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Failed to fetch books:", error.message)
    process.exit(1)
  }

  console.log(`Found ${books.length} books to enrich`)

  let enriched = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (book) => {
        const isbn = book.isbn_13 ?? book.isbn_10
        if (!isbn) { skipped++; return }

        const enrichment = await enrichFromOpenLibrary(isbn)
        if (!enrichment) {
          console.log(`  ✗ Not found on OL: "${book.title}" (${isbn})`)
          skipped++
          return
        }

        // Only update fields that OL actually provided (don't overwrite existing data with null)
        const patch: Record<string, unknown> = {}
        if (enrichment.first_published_date) patch.first_published_date = enrichment.first_published_date
        if (enrichment.edition_format)        patch.edition_format        = enrichment.edition_format
        if (enrichment.series_name)           patch.series_name           = enrichment.series_name
        if (enrichment.series_position != null) patch.series_position     = enrichment.series_position

        if (Object.keys(patch).length === 0) {
          console.log(`  – No new data for: "${book.title}"`)
          skipped++
          return
        }

        const { error: updateError } = await supabase
          .from("books")
          .update(patch)
          .eq("id", book.id)

        if (updateError) {
          console.error(`  ✗ Update failed for "${book.title}":`, updateError.message)
          failed++
        } else {
          const fields = Object.keys(patch).join(", ")
          console.log(`  ✓ "${book.title}" — updated: ${fields}`)
          enriched++
        }
      })
    )

    if (i + BATCH_SIZE < books.length) await sleep(DELAY_MS)

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, books.length)}/${books.length}`)
  }

  console.log(`\nDone — enriched: ${enriched}, skipped/not found: ${skipped}, failed: ${failed}`)
}

main()
