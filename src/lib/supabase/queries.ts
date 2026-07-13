import { cacheTag, cacheLife } from "next/cache"
import { createAdminClient } from "./server"

const HIDDEN_SLUGS = new Set(["litterature"])

// Genre + format list for catalogue browse (1 hour — changes only when books with new genres are imported)
export async function getGenresWithBooks() {
  "use cache"
  cacheLife("hours")
  cacheTag("genres")

  const admin = createAdminClient()
  const { data } = await admin
    .from("genres")
    .select("id, slug, label, type, book_genres!inner(genre_id)")
    .order("label")

  return (data ?? [])
    .filter((g: any) => !HIDDEN_SLUGS.has(g.slug))
    .map((g: any) => ({ id: g.id as number, slug: g.slug as string, label: g.label as string, type: (g.type ?? "genre") as string }))
}

// Recently active books for catalogue homepage (5 min — changes when users add books)
export async function getRecentBooks() {
  "use cache"
  cacheLife({ revalidate: 300 })
  cacheTag("books")

  const admin = createAdminClient()
  const [{ data: ubRows }, { data: lbRows }] = await Promise.all([
    admin.from("user_books").select("book_id, updated_at").order("updated_at", { ascending: false }).limit(200),
    admin.from("list_books").select("book_id, added_at").order("added_at", { ascending: false }).limit(200),
  ])

  const latestByBook = new Map<string, string>()
  for (const row of (ubRows ?? [])) {
    const cur = latestByBook.get(row.book_id)
    if (!cur || row.updated_at > cur) latestByBook.set(row.book_id, row.updated_at)
  }
  for (const row of (lbRows ?? [])) {
    const cur = latestByBook.get(row.book_id)
    if (!cur || row.added_at > cur) latestByBook.set(row.book_id, row.added_at)
  }

  const topIds = [...latestByBook.entries()]
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .slice(0, 24)
    .map(([id]) => id)

  if (!topIds.length) return []

  const { data } = await admin
    .from("books")
    .select("id, title, cover_url, book_authors(display_order, role, author:authors(name))")
    .in("id", topIds)

  const order = new Map(topIds.map((id, i) => [id, i]))
  return (data ?? []).sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
}

// Books filtered by genre slug (5 min)
export async function getBooksByGenre(genreSlug: string) {
  "use cache"
  cacheLife({ revalidate: 300 })
  cacheTag("books", `genre-${genreSlug}`)

  const admin = createAdminClient()
  const { data: genreRow } = await admin.from("genres").select("id").eq("slug", genreSlug).single()
  if (!genreRow) return []

  const { data: bookIdRows } = await admin.from("book_genres").select("book_id").eq("genre_id", genreRow.id)
  const ids = (bookIdRows ?? []).map((r: any) => r.book_id)
  if (!ids.length) return []

  const { data } = await admin
    .from("books")
    .select("id, title, cover_url, book_authors(display_order, role, author:authors(name))")
    .in("id", ids)
    .order("created_at", { ascending: false })
    .limit(24)

  return data ?? []
}

// Book metadata + authors + publisher (5 min — changes when metadata is updated)
export async function getBookDetail(id: string) {
  "use cache"
  cacheLife({ revalidate: 300 })
  cacheTag("books", `book-${id}`)

  const admin = createAdminClient()
  const { data } = await admin
    .from("books")
    .select("*, publisher:publishers(name), book_authors(role, display_order, author:authors(id, name)), book_genres(genres(slug, label, type))")
    .eq("id", id)
    .single()

  return data
}

// Community reviews for a book (5 min — cleared immediately on new review via revalidateTag)
export async function getCommunityReviews(bookId: string, excludeUserId: string) {
  "use cache"
  cacheLife({ revalidate: 300 })
  cacheTag(`reviews-${bookId}`)

  const admin = createAdminClient()
  const { data: reviews } = await admin
    .from("reviews")
    .select(`id, body, is_spoiler, created_at, updated_at, book_id, user_id,
      profile:profiles!user_id(username, display_name, avatar_url)`)
    .eq("book_id", bookId)
    .eq("is_private", false)
    .neq("user_id", excludeUserId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (!reviews?.length) return { reviews: [], ratingMap: {}, commentsByReview: {} as Record<string, any[]> }

  const reviewUserIds = reviews.map((r) => r.user_id)
  const reviewIds = reviews.map((r) => r.id)

  const [{ data: otherRatings }, { data: allComments }] = await Promise.all([
    admin.from("ratings").select("user_id, score").eq("book_id", bookId).in("user_id", reviewUserIds),
    admin.from("comments")
      .select("id, body, created_at, user_id, review_id, profile:profiles!user_id(username, display_name, avatar_url)")
      .in("review_id", reviewIds)
      .order("created_at", { ascending: true }),
  ])

  const ratingMap = Object.fromEntries((otherRatings ?? []).map((r) => [r.user_id, r.score]))
  const commentsByReview: Record<string, any[]> = {}
  for (const c of allComments ?? []) {
    if (!commentsByReview[c.review_id]) commentsByReview[c.review_id] = []
    commentsByReview[c.review_id].push(c)
  }

  return { reviews, ratingMap, commentsByReview }
}

// Search books already in our DB by title or author name (not cached — query-dependent)
// Uses pg_trgm similarity for fuzzy matching (tolerates ~1-2 character typos)
export async function searchLocalBooks(query: string, limit = 6) {
  const admin = createAdminClient()

  // Fuzzy search: match books whose title or any author name is similar to the query
  const { data: rows, error } = await admin.rpc("search_books_fuzzy", {
    search_query: query,
    result_limit: limit,
  })

  // Fallback to ILIKE if pg_trgm isn't available or RPC fails
  if (error) {
    const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`
    const [{ data: byTitle }, { data: authorRows }] = await Promise.all([
      admin.from("books").select("id, title, cover_url, google_books_id, book_authors(display_order, role, author:authors(name))").ilike("title", pattern).limit(limit),
      admin.from("authors").select("id").ilike("name", pattern).limit(20),
    ])

    const authorIds = (authorRows ?? []).map((a: any) => a.id)
    let byAuthor: any[] = []
    if (authorIds.length > 0) {
      const { data: baRows } = await admin.from("book_authors").select("book_id").in("author_id", authorIds).eq("role", "author").limit(limit)
      const bookIds = [...new Set((baRows ?? []).map((r: any) => r.book_id))]
      if (bookIds.length > 0) {
        const { data } = await admin.from("books").select("id, title, cover_url, google_books_id, book_authors(display_order, role, author:authors(name))").in("id", bookIds).limit(limit)
        byAuthor = data ?? []
      }
    }

    const seen = new Map<string, any>()
    for (const book of [...(byTitle ?? []), ...byAuthor]) {
      if (!seen.has(book.id) || (!seen.get(book.id).cover_url && book.cover_url)) seen.set(book.id, book)
    }
    return formatBooks([...seen.values()].slice(0, limit))
  }

  return formatBooks(rows ?? [])
}

function formatBooks(books: { id: string; title: string; cover_url: string | null; google_books_id?: string | null; book_authors?: { role: string; display_order: number; author?: { name: string } | null }[] | null }[]) {
  return books.map((b) => ({
    id: b.id,
    title: b.title,
    cover_url: b.cover_url,
    google_books_id: b.google_books_id ?? null,
    authors: (b.book_authors ?? [])
      .filter((ba) => ba.role === "author")
      .sort((a, b) => a.display_order - b.display_order)
      .map((ba) => ba.author?.name)
      .filter((n): n is string => !!n),
  }))
}

// Books sharing the most genres with a given book (5 min — for recommendations section)
export async function getBookRecommendations(bookId: string) {
  "use cache"
  cacheLife({ revalidate: 300 })
  cacheTag(`book-recommendations-${bookId}`)

  const admin = createAdminClient()

  const { data: thisBookGenres } = await admin
    .from("book_genres")
    .select("genre_id, genres(type)")
    .eq("book_id", bookId)

  const genreIds = (thisBookGenres ?? [])
    .filter((r: any) => (r.genres?.type ?? "genre") === "genre")
    .map((r: any) => r.genre_id)

  if (!genreIds.length) return []

  const { data: sharedRows } = await admin
    .from("book_genres")
    .select("book_id, genre_id")
    .in("genre_id", genreIds)
    .neq("book_id", bookId)

  const sharedCountByBook = new Map<string, number>()
  for (const row of sharedRows ?? []) {
    sharedCountByBook.set(row.book_id, (sharedCountByBook.get(row.book_id) ?? 0) + 1)
  }

  const candidateIds = [...sharedCountByBook.keys()].slice(0, 50)
  if (!candidateIds.length) return []

  const { data: candidateBooks } = await admin
    .from("books")
    .select("id, title, cover_url, avg_rating")
    .in("id", candidateIds)

  return (candidateBooks ?? [])
    .sort((a: any, b: any) => {
      const sharedDiff = (sharedCountByBook.get(b.id) ?? 0) - (sharedCountByBook.get(a.id) ?? 0)
      if (sharedDiff !== 0) return sharedDiff
      return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0)
    })
    .slice(0, 6)
}

// Author page data (1 hour — author metadata rarely changes)
export async function getAuthorDetail(id: string) {
  "use cache"
  cacheLife("hours")
  cacheTag(`author-${id}`)

  const admin = createAdminClient()
  const { data: author } = await admin
    .from("authors")
    .select("id, name, bio, photo_url, birth_date, death_date")
    .eq("id", id)
    .single()

  if (!author) return null

  const { data: bookRows } = await admin
    .from("book_authors")
    .select("display_order, book:books(id, title, cover_url, avg_rating, published_date)")
    .eq("author_id", id)
    .eq("role", "author")

  const books = (bookRows ?? [])
    .map((r: any) => r.book)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.published_date ?? "9999").localeCompare(b.published_date ?? "9999"))

  return { author, books }
}
