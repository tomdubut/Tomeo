
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import FilterChip from "@/components/ui/FilterChip"
import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileSubNav from "@/components/profile/ProfileSubNav"
import LibrarySearchBar from "@/components/library/LibrarySearchBar"
import LibrarySortSelect from "@/components/library/LibrarySortSelect"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { BookSummary } from "@/lib/types"

const PAGE_SIZE = 24

type UserBookRow = {
  status: string
  updated_at: string
  finished_at: string | null
  book_id: string
  book: BookSummary | null
}

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ shelf?: string; sort?: string; genre?: string; search?: string; page?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `@${username} — Tomeo` }
}

const SHELVES = [
  { key: "all", label: "Tous" },
  { key: "read", label: "Lus" },
  { key: "currently_reading", label: "En cours" },
  { key: "want_to_read", label: "À lire" },
] as const

type ShelfKey = (typeof SHELVES)[number]["key"]

const SORT_OPTIONS = [
  { key: "recent", label: "Ajout récent" },
  { key: "date_read_desc", label: "Lu récemment" },
  { key: "date_read_asc", label: "Lu il y a longtemps" },
  { key: "rating_desc", label: "Meilleures notes" },
  { key: "rating_asc", label: "Moins bonnes notes" },
] as const

type SortKey = (typeof SORT_OPTIONS)[number]["key"]

function libraryHref(username: string, shelf: string, sort: string, genre: string, search: string, page?: number) {
  const p = new URLSearchParams()
  if (shelf !== "all") p.set("shelf", shelf)
  if (sort !== "recent") p.set("sort", sort)
  if (genre) p.set("genre", genre)
  if (search) p.set("search", search)
  if (page && page > 1) p.set("page", String(page))
  const qs = p.toString()
  return `/users/${username}/library${qs ? `?${qs}` : ""}`
}

export default async function UserLibraryPage({ params, searchParams }: Props) {
  const { username } = await params
  const { shelf = "all", sort = "recent", genre = "", search = "", page: pageParam = "1" } = await searchParams
  const activeShelf = (SHELVES.some((s) => s.key === shelf) ? shelf : "all") as ShelfKey
  const activeSort = (SORT_OPTIONS.some((s) => s.key === sort) ? sort : "recent") as SortKey
  const activeGenre = genre.trim()
  const activeSearch = search.trim().toLowerCase()
  const currentPage = Math.max(1, parseInt(pageParam) || 1)

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single()

  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const isOwnProfile = currentUser?.id === profile.id

  let isFollowing = false
  if (currentUser && !isOwnProfile) {
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .single()
    isFollowing = !!data
  }

  const [{ count: bookCount }, { count: followerCount }, { count: followingCount }] =
    await Promise.all([
      supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    ])

  const thisYear = new Date().getFullYear()
  const yearStart = `${thisYear}-01-01`

  // Lightweight scan: book_id + status + finished_at + title (for text search)
  // This stays fast even at thousands of books — no cover_url or nested data
  const { data: allUserBooks } = await supabase
    .from("user_books")
    .select("book_id, status, finished_at, book:books(id, title)")
    .eq("user_id", profile.id)

  // Derive counts + ID sets from the scan
  const countByShelf: Record<string, number> = {}
  const allBookIds: string[] = []
  const readBookIds: string[] = []
  const titleByBookId: Record<string, string> = {}

  for (const row of allUserBooks ?? []) {
    countByShelf[row.status] = (countByShelf[row.status] ?? 0) + 1
    allBookIds.push(row.book_id)
    if (row.status === "read") readBookIds.push(row.book_id)
    const bookTitle = (row.book as any)?.title
    if (bookTitle) titleByBookId[row.book_id] = bookTitle.toLowerCase()
  }

  const totalCount = allBookIds.length
  const booksThisYear = (allUserBooks ?? []).filter((r: any) => r.status === "read" && r.finished_at && r.finished_at >= yearStart).length

  // Genres + ratings + authors in parallel
  const [{ data: bgRows }, { data: userRatings }, { data: baRows }] = await Promise.all([
    allBookIds.length
      ? supabase.from("book_genres").select("book_id, genre_id, genres(id, slug, label, type)").in("book_id", allBookIds)
      : Promise.resolve({ data: [] }),
    readBookIds.length
      ? supabase.from("ratings").select("book_id, score").eq("user_id", profile.id).in("book_id", readBookIds)
      : Promise.resolve({ data: [] }),
    allBookIds.length
      ? supabase.from("book_authors").select("book_id, authors(name)").in("book_id", allBookIds).eq("role", "author")
      : Promise.resolve({ data: [] }),
  ])

  const avgRating = (userRatings ?? []).length
    ? Math.round(((userRatings ?? []).reduce((sum, r) => sum + Number(r.score), 0) / (userRatings ?? []).length) * 10) / 10
    : null

  const ratingByBook: Record<string, number> = {}
  for (const r of userRatings ?? []) ratingByBook[r.book_id] = Number(r.score)

  // Build genre + format lists
  const HIDDEN_SLUGS = new Set(["litterature"])
  let genreList: Array<{ id: number; slug: string; label: string; type: string }> = []
  let formatList: Array<{ id: number; slug: string; label: string; type: string }> = []
  let topGenre: string | null = null
  let genreBookIdSet: Set<string> | null = null

  if ((bgRows ?? []).length) {
    const readBookIdSet = new Set(readBookIds)
    const seen = new Map<number, { id: number; slug: string; label: string; type: string }>()
    const readGenreCount = new Map<number, { label: string; count: number }>()

    for (const row of bgRows ?? []) {
      const g = row.genres as unknown as { id: number; slug: string; label: string; type: string | null } | null
      if (!g || HIDDEN_SLUGS.has(g.slug)) continue
      if (!seen.has(g.id)) seen.set(g.id, { ...g, type: g.type ?? "genre" })
      if (readBookIdSet.has(row.book_id) && (g.type ?? "genre") === "genre") {
        const prev = readGenreCount.get(g.id) ?? { label: g.label, count: 0 }
        readGenreCount.set(g.id, { label: g.label, count: prev.count + 1 })
      }
    }
    const allTags = Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, "fr"))
    genreList = allTags.filter((g) => g.type === "genre")
    formatList = allTags.filter((g) => g.type === "format")
    const topEntry = Array.from(readGenreCount.values()).sort((a, b) => b.count - a.count)[0]
    topGenre = topEntry?.label ?? null

    if (activeGenre) {
      const activeGenreId = allTags.find((g) => g.slug === activeGenre)?.id
      if (activeGenreId !== undefined) {
        genreBookIdSet = new Set(
          (bgRows ?? []).filter((r) => r.genre_id === activeGenreId).map((r) => r.book_id)
        )
      }
    }
  }

  const authorsByBook: Record<string, string[]> = {}
  for (const row of baRows ?? []) {
    const authors = row.authors as unknown as { name: string } | null
    if (authors?.name) {
      if (!authorsByBook[row.book_id]) authorsByBook[row.book_id] = []
      authorsByBook[row.book_id].push(authors.name.toLowerCase())
    }
  }

  // Compute filtered + sorted list of book IDs entirely in-memory (cheap — just IDs + metadata)
  let filteredRows = (allUserBooks ?? []).filter((row) => {
    if (activeShelf !== "all" && row.status !== activeShelf) return false
    if (genreBookIdSet && !genreBookIdSet.has(row.book_id)) return false
    if (activeSearch) {
      const titleMatch = titleByBookId[row.book_id]?.includes(activeSearch)
      const authorNames = authorsByBook[row.book_id] ?? []
      const authorMatch = authorNames.some((name) =>
        name.split(" ").some((part) => part.startsWith(activeSearch)) || name.includes(activeSearch)
      )
      if (!titleMatch && !authorMatch) return false
    }
    return true
  })

  // Sort
  if (activeSort === "date_read_desc") {
    filteredRows.sort((a, b) => {
      if (!a.finished_at && !b.finished_at) return 0
      if (!a.finished_at) return 1
      if (!b.finished_at) return -1
      return b.finished_at.localeCompare(a.finished_at)
    })
  } else if (activeSort === "date_read_asc") {
    filteredRows.sort((a, b) => {
      if (!a.finished_at && !b.finished_at) return 0
      if (!a.finished_at) return 1
      if (!b.finished_at) return -1
      return a.finished_at.localeCompare(b.finished_at)
    })
  } else if (activeSort === "rating_desc" || activeSort === "rating_asc") {
    const dir = activeSort === "rating_desc" ? -1 : 1
    filteredRows.sort((a, b) => {
      const ra = ratingByBook[a.book_id]
      const rb = ratingByBook[b.book_id]
      if (ra === undefined && rb === undefined) return 0
      if (ra === undefined) return 1
      if (rb === undefined) return -1
      return (ra - rb) * dir
    })
  } else {
    // "recent" — sort by updated_at desc (allUserBooks doesn't carry this; rely on DB insertion order)
    // allUserBooks is fetched without order, so for "recent" we use the order from a fresh ordered scan
    // We'll handle this by fetching with order below
  }

  const totalFiltered = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const offset = (safePage - 1) * PAGE_SIZE
  const pageBookIds = filteredRows.slice(offset, offset + PAGE_SIZE).map((r) => r.book_id)

  // Display query: only the current page's books (full data)
  let pageBooks: UserBookRow[] = []
  if (pageBookIds.length > 0) {
    let q = supabase
      .from("user_books")
      .select(`status, updated_at, finished_at, book_id, book:books(id, title, cover_url, avg_rating, book_authors(display_order, role, author:authors(name)))`)
      .eq("user_id", profile.id)
      .in("book_id", pageBookIds)

    // Apply DB-level ordering for "recent" sort (the only sort that needs DB order)
    if (activeSort === "recent") {
      q = q.order("updated_at", { ascending: false })
    }

    const { data } = await q
    if (data) {
      const typed = data as unknown as UserBookRow[]
      if (activeSort === "recent") {
        pageBooks = typed
      } else {
        const map = new Map(typed.map((b) => [b.book_id, b]))
        pageBooks = pageBookIds.map((id) => map.get(id)).filter((b): b is UserBookRow => !!b)
      }
    }
  }

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-4xl mx-auto">

      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        currentUserId={currentUser?.id ?? null}
        isFollowing={isFollowing}
        bookCount={bookCount ?? 0}
        followerCount={followerCount ?? 0}
        followingCount={followingCount ?? 0}
      >
        {(booksThisYear > 0 || avgRating !== null || topGenre) && (
          <>
            <div className="my-6 h-px bg-[--border]" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "var(--card)" }}>
                <p className="text-3xl font-semibold leading-none">{booksThisYear}</p>
                <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Lus en {thisYear}</p>
              </div>
              <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "var(--card)" }}>
                <p className="text-3xl font-semibold leading-none">{readBookIds.length}</p>
                <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Lus au total</p>
              </div>
              <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "var(--card)" }}>
                <p className="text-3xl font-semibold leading-none">{avgRating ?? "—"}</p>
                <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Note moyenne</p>
              </div>
              <div
                className="rounded-2xl px-4 py-4 text-center"
                style={{
                  background: topGenre ? "var(--secondary-accent)" : "var(--card)",
                  color: topGenre ? "var(--secondary-accent-foreground)" : "var(--foreground)",
                }}
              >
                <p className="text-lg font-semibold leading-tight">{topGenre ?? "—"}</p>
                <p className={cn("text-xs mt-1.5 font-medium", topGenre ? "text-white/75" : "text-[--muted-foreground]")}>Genre favori</p>
              </div>
            </div>
          </>
        )}
      </ProfileHeader>

      <div className="rounded-2xl bg-[--card] p-6 sm:p-8 space-y-6">
        <ProfileSubNav username={username} />

        <LibrarySearchBar username={username} initialSearch={activeSearch} shelf={activeShelf} sort={activeSort} genre={activeGenre} />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 rounded-2xl bg-[--secondary] p-1 overflow-x-auto">
            {SHELVES.map(({ key, label }) => {
              const count = key === "all" ? totalCount : (countByShelf[key] ?? 0)
              return (
                <Link
                  key={key}
                  href={libraryHref(username, key, activeSort, activeGenre, activeSearch)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap",
                    activeShelf === key ? "text-white" : "text-[--muted-foreground] hover:text-[--foreground]"
                  )}
                  style={activeShelf === key ? { background: "var(--primary)" } : {}}
                >
                  {label}
                  {count > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-semibold", activeShelf === key ? "bg-white/25 text-white" : "bg-[--border] text-[--muted-foreground]")}>
                      {count}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {totalCount > 0 && (
            <LibrarySortSelect username={username} shelf={activeShelf} sort={activeSort} genre={activeGenre} search={activeSearch} />
          )}
        </div>

        {(formatList.length > 0 || genreList.length > 0) && (
          <div className="space-y-4">
            {formatList.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[--muted-foreground] mb-2">Format</p>
                <div className="flex flex-wrap gap-2">
                  {formatList.map((g) => {
                    const isActive = g.slug === activeGenre
                    return (
                      <FilterChip
                        key={g.slug}
                        label={g.label}
                        href={libraryHref(username, activeShelf, activeSort, isActive ? "" : g.slug, activeSearch)}
                        isActive={isActive}
                      />
                    )
                  })}
                </div>
              </div>
            )}
            {genreList.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[--muted-foreground] mb-2">Genre</p>
                <div className="flex flex-wrap gap-2">
                  {genreList.map((g) => {
                    const isActive = g.slug === activeGenre
                    return (
                      <FilterChip
                        key={g.slug}
                        label={g.label}
                        href={libraryHref(username, activeShelf, activeSort, isActive ? "" : g.slug, activeSearch)}
                        isActive={isActive}
                        accent
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Book grid */}
        {!pageBooks.length ? (
          <div className="px-6 py-10 sm:p-14 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
              <BookOpen className="h-8 w-8 text-[--primary]" />
            </div>
            <p className="text-lg font-bold">
              {activeSearch
                ? `Aucun résultat pour "${activeSearch}"`
                : activeGenre
                  ? `Aucun livre dans ce genre`
                  : isOwnProfile
                    ? activeShelf === "all" ? "Votre bibliothèque est vide" : `Aucun livre dans "${SHELVES.find((s) => s.key === activeShelf)?.label}"`
                    : `${displayName} n'a pas encore de livres ici`}
            </p>
            {isOwnProfile && !activeSearch && !activeGenre && activeShelf === "all" && (
              <>
                <p className="mt-2 text-sm text-[--muted-foreground]">Ajoutez des livres lus, en cours ou à lire pour les retrouver ici.</p>
                <div className="mt-5">
                  <Button asChild><Link href="/books">Parcourir le catalogue</Link></Button>
                </div>
              </>
            )}
            {isOwnProfile && (activeSearch || activeGenre || activeShelf !== "all") && (
              <div className="mt-5">
                <Button asChild variant="outline"><Link href={`/users/${username}/library`}>Voir toute la bibliothèque</Link></Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {pageBooks.map((ub) => {
                const book = ub.book
                if (!book) return null
                const authors = (book.book_authors ?? [])
                  .filter((ba) => ba.role === "author")
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((ba) => ba.author?.name)
                  .filter((n): n is string => !!n)

                return (
                  <Link key={book.id} href={`/books/${book.id}`} className="group">
                    <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-[--secondary] mb-2" style={{ boxShadow: "var(--shadow-sm)" }}>
                      {book.cover_url ? (
                        <Image src={book.cover_url} alt={`Couverture de ${book.title}`} fill className="object-cover group-hover:opacity-90 transition-opacity" sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw" unoptimized />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-8 w-8 text-[--muted-foreground]" />
                        </div>
                      )}
                      <div className="absolute bottom-1.5 left-1.5">
                        <StatusBadge status={ub.status} />
                      </div>
                    </div>
                    <p className="text-xs font-semibold line-clamp-2 group-hover:underline leading-tight">{book.title}</p>
                    {authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{authors[0]}</p>}
                    {ratingByBook[ub.book_id] !== undefined && (
                      <p className="text-xs text-[--primary] font-semibold mt-0.5">★ {ratingByBook[ub.book_id]}</p>
                    )}
                    {ub.status === "read" && ub.finished_at && (
                      <p className="text-xs text-[--muted-foreground] mt-0.5">
                        {new Date(ub.finished_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Link
                  href={libraryHref(username, activeShelf, activeSort, activeGenre, activeSearch, safePage - 1)}
                  aria-disabled={safePage <= 1}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                    safePage <= 1
                      ? "pointer-events-none opacity-30"
                      : "hover:bg-[--secondary]"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Link>

                <p className="text-sm text-[--muted-foreground]">
                  Page <span className="font-semibold text-[--foreground]">{safePage}</span> sur <span className="font-semibold text-[--foreground]">{totalPages}</span>
                </p>

                <Link
                  href={libraryHref(username, activeShelf, activeSort, activeGenre, activeSearch, safePage + 1)}
                  aria-disabled={safePage >= totalPages}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                    safePage >= totalPages
                      ? "pointer-events-none opacity-30"
                      : "hover:bg-[--secondary]"
                  )}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    read: { label: "Lu", className: "bg-green-600 text-white" },
    currently_reading: { label: "En cours", className: "bg-blue-600 text-white" },
    want_to_read: { label: "À lire", className: "bg-black/50 text-white" },
  }
  const badge = map[status]
  if (!badge) return null
  return (
    <span className={cn("rounded-lg px-1.5 py-0.5 text-[10px] font-bold", badge.className)}>
      {badge.label}
    </span>
  )
}
