/**
 * Backfill the edition format (Poche, Relié, Ebook…) from Open Library for books
 * that don't have one.
 *
 * Only the edition format is taken, same rule as importBook(): Open Library's
 * work-level first_publish_date is often a reprint year (Othello → 2006) and its
 * "series" is often a publisher collection ("A Black cat book"). Existing values
 * are never overwritten.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/backfill-book-metadata.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local.
 */

import { createClient } from "@supabase/supabase-js"
import { enrichFromOpenLibrary } from "../src/lib/api/openlibrary"

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
  // Books with an ISBN and no edition format yet
  const { data: books, error } = await supabase
    .from("books")
    .select("id, isbn_13, isbn_10, title")
    .is("edition_format", null)
    .or("isbn_13.not.is.null,isbn_10.not.is.null")
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

        const patch: Record<string, unknown> = {}
        if (enrichment.edition_format) patch.edition_format = enrichment.edition_format

        if (Object.keys(patch).length === 0) {
          console.log(`  – No new data for: "${book.title}"`)
          skipped++
          return
        }

        const { error: updateError } = await supabase
          .from("books")
          .update(patch)
          .eq("id", book.id)
          .is("edition_format", null) // never overwrite a value set meanwhile

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
