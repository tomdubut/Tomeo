/**
 * Seed script: populates the DB with ~200 real books from Google Books,
 * then adds library entries, ratings, reviews, and lists for a test user.
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts
 *
 * Required env vars (copy .env.local.example and fill in):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_BOOKS_API_KEY
 *   SEED_USER_ID   ← the Supabase auth user ID of your test account
 */

import { createClient } from "@supabase/supabase-js"

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GOOGLE_API_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? ""
const USER_ID = process.env.SEED_USER_ID!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !USER_ID) {
  console.error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_ID")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── Genre map (mirrors src/app/(main)/books/actions.ts) ───────────────────────

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

// ── Google Books helpers ──────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  "roman français litterature",
  "science-fiction français",
  "policier français",
  "fantasy français",
  "philosophie française",
  "thriller français",
  "biographie française",
  "histoire de france",
  "développement personnel",
  "roman historique français",
  "poésie française",
  "psychologie populaire",
  "roman contemporain français",
  "bande dessinée franco-belge",
  "jeunesse roman français",
]

interface GoogleVolume {
  id: string
  volumeInfo: {
    title: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    pageCount?: number
    categories?: string[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    language?: string
  }
}

function normalise(vol: GoogleVolume) {
  const info = vol.volumeInfo
  const isbn13 = info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? null
  const isbn10 = info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ?? null
  const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null
  return {
    google_books_id: vol.id,
    title: info.title,
    subtitle: info.subtitle ?? null,
    description: info.description ?? null,
    language: info.language ?? "fr",
    page_count: info.pageCount ?? null,
    published_date: info.publishedDate ? info.publishedDate.slice(0, 10) : null,
    cover_url: rawCover ? rawCover.replace("http://", "https://").replace("&zoom=1", "&zoom=2") : null,
    isbn_10: isbn10,
    isbn_13: isbn13,
    authors: info.authors ?? [],
    publisher: info.publisher ?? null,
    categories: info.categories ?? [],
  }
}

async function searchBooks(query: string, startIndex: number): Promise<GoogleVolume[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: "20",
    startIndex: String(startIndex),
    printType: "books",
    langRestrict: "fr",
    ...(GOOGLE_API_KEY ? { key: GOOGLE_API_KEY } : {}),
  })
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
  if (!res.ok) {
    console.warn(`  Google API error ${res.status} for "${query}" offset ${startIndex}`)
    return []
  }
  const data = await res.json()
  return (data.items ?? []).filter((v: GoogleVolume) =>
    v.volumeInfo?.language === "fr" && v.volumeInfo?.title
  )
}

// ── Import a single book into the DB ─────────────────────────────────────────

async function importVolume(vol: GoogleVolume): Promise<string | null> {
  const n = normalise(vol)

  // Dedup by google_books_id
  const { data: ex1 } = await supabase.from("books").select("id").eq("google_books_id", n.google_books_id).single()
  if (ex1) return ex1.id

  // Dedup by isbn_13
  if (n.isbn_13) {
    const { data: ex2 } = await supabase.from("books").select("id").eq("isbn_13", n.isbn_13).single()
    if (ex2) return ex2.id
  }

  // Publisher
  let publisherId: string | null = null
  if (n.publisher) {
    const { data: pub } = await supabase
      .from("publishers")
      .upsert({ name: n.publisher }, { onConflict: "name" })
      .select("id")
      .single()
    publisherId = pub?.id ?? null
  }

  // Book
  const { data: book, error } = await supabase
    .from("books")
    .insert({
      title: n.title, subtitle: n.subtitle, description: n.description,
      language: n.language, page_count: n.page_count, published_date: n.published_date,
      cover_url: n.cover_url, isbn_10: n.isbn_10, isbn_13: n.isbn_13,
      google_books_id: n.google_books_id, publisher_id: publisherId,
    })
    .select("id")
    .single()

  if (error || !book) {
    console.warn(`  Failed to insert "${n.title}": ${error?.message}`)
    return null
  }

  // Authors
  for (let i = 0; i < n.authors.length; i++) {
    const name = n.authors[i]
    const parts = name.trim().split(" ")
    const sort_name = parts.length > 1 ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}` : name
    const { data: author } = await supabase
      .from("authors")
      .upsert({ name, sort_name }, { onConflict: "name" } as any)
      .select("id")
      .single()
    if (author) {
      await supabase.from("book_authors").upsert(
        { book_id: book.id, author_id: author.id, role: "author", display_order: i },
        { onConflict: "book_id,author_id,role" }
      )
    }
  }

  // Genres
  for (const genre of mapCategoriesToGenres(n.categories)) {
    const { data: genreRow } = await supabase
      .from("genres")
      .upsert({ slug: genre.slug, label: genre.label }, { onConflict: "slug" })
      .select("id")
      .single()
    if (genreRow) {
      await supabase.from("book_genres").upsert(
        { book_id: book.id, genre_id: genreRow.id },
        { onConflict: "book_id,genre_id" }
      )
    }
  }

  return book.id
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.random() * (max - min) + min }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)) }

/** Random date between `daysAgo` days ago and today, as YYYY-MM-DD */
function randomPastDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo))
  return d.toISOString().slice(0, 10)
}

/** Half-point score between 1 and 10 */
function randomScore(): number {
  return Math.round(rand(1, 10) * 2) / 2
}

const REVIEW_BODIES = [
  "Un roman absolument captivant du début à la fin. L'auteur maîtrise parfaitement son art et nous offre une histoire riche en rebondissements. Je recommande vivement cette lecture à tous les amateurs du genre.",
  "J'ai été agréablement surpris par la profondeur des personnages. L'écriture est fluide et le récit se lit d'une traite. Une belle découverte que je n'oublierai pas de sitôt.",
  "Déçu par ce livre que j'attendais beaucoup. L'intrigue manque de rythme et les personnages restent trop superficiels. Dommage car la prémisse était prometteuse.",
  "Un chef-d'œuvre de la littérature contemporaine. Chaque page recèle une richesse stylistique remarquable. L'auteur explore des thèmes universels avec une sensibilité rare.",
  "Lecture agréable sans être mémorable. On passe un bon moment mais l'histoire ne laisse pas vraiment de trace. Parfait pour une lecture de vacances.",
  "Ce livre m'a profondément ému. Les émotions sont rendues avec une justesse troublante et l'on s'attache immédiatement aux protagonistes. Une lecture qui marque durablement.",
  "Quelques longueurs dans la partie centrale mais l'ensemble reste de bonne facture. Le dénouement est particulièrement bien mené et rattrape les passages moins inspirés.",
  "Une narration originale qui déroute au début mais finit par séduire complètement. L'auteur prend des risques et c'est tout à son honneur. À lire absolument.",
  "Je suis resté sur ma faim. Les grandes idées annoncées en quatrième de couverture ne sont pas vraiment développées. Le style est pourtant agréable.",
  "Fascinant de bout en bout. L'auteur nous transporte dans un univers cohérent et richement détaillé. On referme le livre à regret tant on aurait voulu que ça continue.",
  "Une belle écriture au service d'une histoire touchante. Les dialogues sonnent juste et les descriptions créent une atmosphère prenante. Un coup de cœur.",
  "Trop convenu à mon goût. On devine les rebondissements trop facilement et les personnages manquent d'originalité. Il existe de bien meilleures œuvres dans ce genre.",
  "Un roman ambitieux qui tient toutes ses promesses. La construction narrative est brillante et chaque chapitre apporte son lot de révélations. Bravo à l'auteur.",
  "Lu en une journée tant j'étais accroché. L'auteur sait parfaitement doser tension et émotion. Un vrai talent de conteur qui mérite d'être mieux connu.",
  "Mitigé sur cette lecture. Des passages brillants côtoient des moments moins inspirés. Le résultat final reste positif malgré quelques inégalités.",
  "Ce roman m'a appris beaucoup sur moi-même et sur le monde. Au-delà de l'histoire, c'est une réflexion profonde sur la condition humaine. Une lecture enrichissante.",
  "Honnêtement décevant. J'espérais davantage d'originalité après les critiques élogieuses. L'histoire est correcte mais sans véritable surprise.",
  "Un page-turner efficace qui ne se prend pas au sérieux. On sait ce qu'on lit et c'est exactement ce qu'on attend. Divertissement garanti.",
  "La plume de l'auteur est tout simplement magnifique. Même les scènes les plus banales deviennent de véritables morceaux de bravoure littéraire. Envoutant.",
  "Un début prometteur qui s'essouffle malheureusement en milieu de récit. La fin sauve un peu l'ensemble mais le livre ne tient pas toutes ses promesses initiales.",
  "Inclassable et fascinant. On ne sait jamais où l'auteur nous emmène et c'est précisément ce qui rend cette lecture si addictive. Une vraie surprise.",
  "Bien écrit, bien construit, bien documenté. Tout est bien mais rien ne surprend vraiment. Un bon livre sans être exceptionnel.",
  "Cette lecture a changé ma façon de voir les choses. Rare sont les livres qui ont cet effet. Une œuvre importante qui restera longtemps dans ma bibliothèque.",
  "Des longueurs regrettables qui alourdissent inutilement le récit. En resserrant d'une centaine de pages, ce roman aurait été bien meilleur.",
  "Un classique instantané. Je comprends maintenant pourquoi tout le monde en parle. Accessible et profond à la fois, c'est un équilibre difficile à atteindre.",
  "Troublant et dérangeant dans le bon sens du terme. L'auteur n'a pas peur d'aller dans des zones d'ombre et c'est ce qui rend ce roman si marquant.",
  "Une aventure littéraire que je suis heureux d'avoir vécue. Chaque personnage est fouillé, chaque situation sonne juste. Du grand art.",
  "Pas ma tasse de thé habituellement mais j'ai été conquis. Parfois il faut sortir de sa zone de confort pour faire de belles découvertes.",
  "Solide sans être transcendant. L'auteur connaît son métier et ça se voit. Pour les fans du genre c'est un incontournable.",
  "Une fin inattendue qui remet tout en perspective. J'ai dû relire les dernières pages plusieurs fois. Chapeau à l'auteur pour cette construction maîtrisée.",
]

const LIST_CONFIGS = [
  {
    title: "Mes coups de cœur",
    description: "Les livres qui m'ont le plus marqué cette année.",
    is_public: true,
    count: 15,
  },
  {
    title: "À lire cet été",
    description: "Ma sélection pour les vacances.",
    is_public: true,
    count: 12,
  },
  {
    title: "Lectures secrètes",
    description: null,
    is_public: false,
    count: 8,
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting seed...\n")

  // ── Step 1: Fetch & import books ──────────────────────────────────────────

  console.log("📚 Step 1: Fetching books from Google Books API...")
  const TARGET = 200
  const allVolumes: GoogleVolume[] = []
  const seenIds = new Set<string>()

  for (const query of SEARCH_QUERIES) {
    if (allVolumes.length >= TARGET) break
    for (let offset = 0; offset < 40; offset += 20) {
      if (allVolumes.length >= TARGET) break
      console.log(`  Searching "${query}" offset=${offset}...`)
      const vols = await searchBooks(query, offset)
      for (const v of vols) {
        if (!seenIds.has(v.id)) {
          seenIds.add(v.id)
          allVolumes.push(v)
        }
      }
      // Respect Google rate limits
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  console.log(`  → ${allVolumes.length} unique volumes fetched\n`)

  console.log("💾 Importing books into DB...")
  const bookIds: string[] = []
  for (let i = 0; i < allVolumes.length; i++) {
    const vol = allVolumes[i]
    process.stdout.write(`  [${i + 1}/${allVolumes.length}] ${vol.volumeInfo.title.slice(0, 50).padEnd(52)}`)
    try {
      const id = await importVolume(vol)
      if (id) {
        bookIds.push(id)
        process.stdout.write("✓\n")
      } else {
        process.stdout.write("skip\n")
      }
    } catch (e) {
      process.stdout.write(`error: ${e}\n`)
    }
    // Small delay to avoid hammering Google
    await new Promise((r) => setTimeout(r, 100))
  }
  console.log(`\n  → ${bookIds.length} books in DB\n`)

  // ── Step 2: Library entries ───────────────────────────────────────────────

  console.log("📖 Step 2: Adding library entries...")

  // Clear existing entries for this user to make re-runs idempotent
  await supabase.from("user_books").delete().eq("user_id", USER_ID)
  await supabase.from("ratings").delete().eq("user_id", USER_ID)
  await supabase.from("reviews").delete().eq("user_id", USER_ID)

  const shuffled = [...bookIds].sort(() => Math.random() - 0.5)
  const readCount = Math.floor(shuffled.length * 0.4)
  const currentCount = Math.floor(shuffled.length * 0.1)

  const readBooks = shuffled.slice(0, readCount)
  const currentBooks = shuffled.slice(readCount, readCount + currentCount)
  const wantBooks = shuffled.slice(readCount + currentCount)

  // Read books with finish dates and ratings
  for (const bookId of readBooks) {
    const finishedAt = randomPastDate(730) // up to 2 years ago
    await supabase.from("user_books").upsert(
      { user_id: USER_ID, book_id: bookId, status: "read", finished_at: finishedAt },
      { onConflict: "user_id,book_id" }
    )
    // All read books get a rating
    const score = randomScore()
    await supabase.from("ratings").upsert(
      { user_id: USER_ID, book_id: bookId, score },
      { onConflict: "user_id,book_id" }
    )
  }

  // Currently reading
  for (const bookId of currentBooks) {
    await supabase.from("user_books").upsert(
      { user_id: USER_ID, book_id: bookId, status: "currently_reading" },
      { onConflict: "user_id,book_id" }
    )
  }

  // Want to read
  for (const bookId of wantBooks) {
    await supabase.from("user_books").upsert(
      { user_id: USER_ID, book_id: bookId, status: "want_to_read" },
      { onConflict: "user_id,book_id" }
    )
  }

  console.log(`  → ${readBooks.length} lu, ${currentBooks.length} en cours, ${wantBooks.length} à lire\n`)

  // ── Step 3: Reviews ───────────────────────────────────────────────────────

  console.log("✍️  Step 3: Adding reviews...")

  const reviewBooks = readBooks.sort(() => Math.random() - 0.5).slice(0, 30)
  for (const bookId of reviewBooks) {
    const body = pick(REVIEW_BODIES)
    const isSpoiler = Math.random() < 0.15
    const isPrivate = Math.random() < 0.2
    await supabase.from("reviews").upsert(
      { user_id: USER_ID, book_id: bookId, body, is_spoiler: isSpoiler, is_private: isPrivate },
      { onConflict: "user_id,book_id" }
    )
  }

  console.log(`  → ${reviewBooks.length} reviews added (some with spoilers / private)\n`)

  // ── Step 4: Lists ─────────────────────────────────────────────────────────

  console.log("📋 Step 4: Creating lists...")

  // Remove existing lists for clean re-run
  const { data: existingLists } = await supabase.from("lists").select("id").eq("user_id", USER_ID)
  if (existingLists?.length) {
    await supabase.from("lists").delete().eq("user_id", USER_ID)
  }

  const listBookPool = [...bookIds].sort(() => Math.random() - 0.5)
  let poolOffset = 0

  for (const cfg of LIST_CONFIGS) {
    const { data: list } = await supabase
      .from("lists")
      .insert({ user_id: USER_ID, title: cfg.title, description: cfg.description, is_public: cfg.is_public })
      .select("id")
      .single()

    if (!list) continue

    const slice = listBookPool.slice(poolOffset, poolOffset + cfg.count)
    poolOffset += cfg.count

    for (let pos = 0; pos < slice.length; pos++) {
      await supabase.from("list_books").upsert(
        { list_id: list.id, book_id: slice[pos], position: pos + 1 },
        { onConflict: "list_id,book_id" }
      )
    }
    console.log(`  → List "${cfg.title}" (${slice.length} books, ${cfg.is_public ? "public" : "private"})`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log("\n✅ Seed complete!")
  console.log(`   Books imported : ${bookIds.length}`)
  console.log(`   Library entries: ${readBooks.length + currentBooks.length + wantBooks.length}`)
  console.log(`   Ratings        : ${readBooks.length}`)
  console.log(`   Reviews        : ${reviewBooks.length}`)
  console.log(`   Lists          : ${LIST_CONFIGS.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
