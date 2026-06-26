import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: books, error } = await supabase
    .from("books")
    .select("id, isbn_13, isbn_10, title")
    .not("isbn_13", "is", null)
    .limit(3)

  if (error) { console.error(error.message); process.exit(1) }

  console.log("Sample books from DB:")
  for (const book of books) {
    console.log(`  "${book.title}" — isbn_13: ${book.isbn_13}, isbn_10: ${book.isbn_10}`)
  }

  // Test first book against OL directly
  const isbn = books[0]?.isbn_13
  if (!isbn) { console.log("No ISBN found"); return }

  console.log(`\nTesting OL fetch for ISBN: ${isbn}`)
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
    headers: { "User-Agent": "Tomeo/1.0 (contact@tomeo.app)" },
  })
  console.log(`  Status: ${res.status} ${res.statusText}`)
  if (res.ok) {
    const data = await res.json()
    console.log(`  Title: ${data.title}`)
    console.log(`  physical_format: ${data.physical_format}`)
    console.log(`  series: ${JSON.stringify(data.series)}`)
    console.log(`  works: ${JSON.stringify(data.works)}`)
  } else {
    console.log("  Not found on Open Library")
  }
}

main()
