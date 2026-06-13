import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { BookOpen, MapPin, Globe } from "lucide-react"
import FollowButton from "@/components/social/FollowButton"
import LibrarySearchBar from "@/components/library/LibrarySearchBar"
import { cn } from "@/lib/utils"

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ shelf?: string; sort?: string; genre?: string; search?: string }>
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

function libraryHref(username: string, shelf: string, sort: string, genre: string, search: string) {
  const p = new URLSearchParams()
  if (shelf !== "all") p.set("shelf", shelf)
  if (sort !== "recent") p.set("sort", sort)
  if (genre) p.set("genre", genre)
  if (search) p.set("search", search)
  const qs = p.toString()
  return `/users/${username}/library${qs ? `?${qs}` : ""}`
}

export default async function UserLibraryPage({ params, searchParams }: Props) {
  const { username } = await params
  const { shelf = "all", sort = "recent", genre = "", search = "" } = await searchParams
  const activeShelf = (SHELVES.some((s) => s.key === shelf) ? shelf : "all") as ShelfKey
  const activeSort = sort === "date_read" ? "date_read" : "recent"
  const activeGenre = genre.trim()
  const activeSearch = search.trim().toLowerCase()

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

  // Shelf counts
  const { data: counts } = await supabase.from("user_books").select("status").eq("user_id", profile.id)
  const countByShelf = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})
  const totalCount = counts?.length ?? 0

  // Reading stats
  const thisYear = new Date().getFullYear()
  const yearStart = `${thisYear}-01-01`

  const { data: readBooks } = await supabase
    .from("user_books")
    .select("book_id, finished_at")
    .eq("user_id", profile.id)
    .eq("status", "read")

  const readBookIds = (readBooks ?? []).map((r: any) => r.book_id)
  const booksThisYear = (readBooks ?? []).filter((r: any) => r.finished_at && r.finished_at >= yearStart).length

  const { data: userRatings } = readBookIds.length
    ? await supabase.from("ratings").select("score").eq("user_id", profile.id).in("book_id", readBookIds)
    : { data: [] }

  const avgRating = userRatings?.length
    ? Math.round((userRatings.reduce((sum, r) => sum + Number(r.score), 0) / userRatings.length) * 10) / 10
    : null

  // All book_ids in this user's library (for genre count + filter)
  const { data: allUserBookIds } = await supabase
    .from("user_books")
    .select("book_id")
    .eq("user_id", profile.id)
  const allBookIds = (allUserBookIds ?? []).map((r: any) => r.book_id)

  // Genres that have at least one book in this user's library
  let genreList: Array<{ id: number; slug: string; label: string }> = []
  let topGenre: string | null = null

  if (allBookIds.length) {
    const { data: bgRows } = await supabase
      .from("book_genres")
      .select("genre_id, genres(id, slug, label)")
      .in("book_id", allBookIds)

    const seen = new Map<number, { id: number; slug: string; label: string }>()
    const genreCount = new Map<number, number>()
    for (const row of bgRows ?? []) {
      const g = (row as any).genres
      if (g) {
        if (!seen.has(g.id)) seen.set(g.id, g)
        genreCount.set(g.id, (genreCount.get(g.id) ?? 0) + 1)
      }
    }
    genreList = Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, "fr"))

    // Top genre = most frequent among read books only
    const { data: readGenreRows } = readBookIds.length
      ? await supabase.from("book_genres").select("genre_id, genres(label)").in("book_id", readBookIds)
      : { data: [] }
    const readGenreCount = new Map<number, { label: string; count: number }>()
    for (const row of readGenreRows ?? []) {
      const g = (row as any).genres
      if (g) {
        const prev = readGenreCount.get(row.genre_id) ?? { label: g.label, count: 0 }
        readGenreCount.set(row.genre_id, { label: g.label, count: prev.count + 1 })
      }
    }
    const topEntry = Array.from(readGenreCount.values()).sort((a, b) => b.count - a.count)[0]
    topGenre = topEntry?.label ?? null
  }

  // If genre filter active, get the book_ids in that genre
  let genreBookIdSet: Set<string> | null = null
  if (activeGenre) {
    const { data: genreRow } = await supabase.from("genres").select("id").eq("slug", activeGenre).single()
    if (genreRow) {
      const { data: bgRows } = await supabase
        .from("book_genres")
        .select("book_id")
        .eq("genre_id", genreRow.id)
      genreBookIdSet = new Set((bgRows ?? []).map((r: any) => r.book_id))
    }
  }

  // Books query
  let query = supabase
    .from("user_books")
    .select(`status, updated_at, finished_at, book_id, book:books(id, title, cover_url, avg_rating, book_authors(display_order, role, author:authors(name)))`)
    .eq("user_id", profile.id)

  if (activeShelf !== "all") query = query.eq("status", activeShelf)

  if (activeSort === "date_read" && (activeShelf === "read" || activeShelf === "all")) {
    query = query.order("finished_at", { ascending: false, nullsFirst: false })
  } else {
    query = query.order("updated_at", { ascending: false })
  }

  const { data: userBooks } = await query

  // Fetch author names for search via two flat queries (joins on aliased tables are unreliable)
  let authorsByBook: Record<string, string[]> = {}
  if (allBookIds.length) {
    const { data: baRows } = await supabase
      .from("book_authors")
      .select("book_id, author_id")
      .in("book_id", allBookIds)
      .eq("role", "author")

    const authorIds = [...new Set((baRows ?? []).map((r: any) => r.author_id))]
    if (authorIds.length) {
      const { data: authorRows } = await supabase
        .from("authors")
        .select("id, name")
        .in("id", authorIds)
      const nameById = Object.fromEntries((authorRows ?? []).map((r: any) => [r.id, r.name as string]))
      for (const row of baRows ?? []) {
        const name = nameById[(row as any).author_id]
        if (name) {
          if (!authorsByBook[(row as any).book_id]) authorsByBook[(row as any).book_id] = []
          authorsByBook[(row as any).book_id].push(name.toLowerCase())
        }
      }
    }
  }

  // Apply genre + search filters
  const filteredBooks = (userBooks ?? []).filter((ub: any) => {
    if (genreBookIdSet && !genreBookIdSet.has(ub.book_id)) return false
    if (activeSearch) {
      const book = ub.book as any
      const titleMatch = book?.title?.toLowerCase().includes(activeSearch)
      const authorNames = authorsByBook[ub.book_id] ?? []
      // Match any individual word in the author name (first name, last name, etc.)
      const authorMatch = authorNames.some((name) =>
        name.split(" ").some((part) => part.startsWith(activeSearch)) || name.includes(activeSearch)
      )
      if (!titleMatch && !authorMatch) return false
    }
    return true
  })

  const displayName = profile.display_name ?? profile.username
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="flex justify-center sm:block">
          <Avatar className="h-20 w-20 ring-4 ring-[--border]">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-[--secondary] text-2xl font-bold">{initials}</AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">{displayName}</h1>
              <p className="text-sm text-[--muted-foreground] font-medium">@{profile.username}</p>
            </div>
            {isOwnProfile ? (
              <Button asChild variant="outline" size="sm">
                <a href="/settings">Modifier le profil</a>
              </Button>
            ) : currentUser ? (
              <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
            ) : null}
          </div>

          {profile.bio && <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>}

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-[--muted-foreground]">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{profile.location}
              </span>
            )}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                <Globe className="h-3.5 w-3.5" />{profile.website_url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          <div className="mt-4 flex gap-5 text-sm">
            <div className="text-center">
              <p className="text-2xl font-extrabold leading-none">{bookCount ?? 0}</p>
              <p className="text-[--muted-foreground] mt-0.5">Livres</p>
            </div>
            <div className="w-px bg-[--border]" />
            <div className="text-center">
              <p className="text-2xl font-extrabold leading-none">{followerCount ?? 0}</p>
              <p className="text-[--muted-foreground] mt-0.5">Abonnés</p>
            </div>
            <div className="w-px bg-[--border]" />
            <div className="text-center">
              <p className="text-2xl font-extrabold leading-none">{followingCount ?? 0}</p>
              <p className="text-[--muted-foreground] mt-0.5">Abonnements</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reading stats */}
      {(booksThisYear > 0 || avgRating !== null || topGenre) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-[--card] px-4 py-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-3xl font-extrabold leading-none">{booksThisYear}</p>
            <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Lus en {thisYear}</p>
          </div>
          <div className="rounded-2xl bg-[--card] px-4 py-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-3xl font-extrabold leading-none">{readBookIds.length}</p>
            <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Lus au total</p>
          </div>
          <div className="rounded-2xl bg-[--card] px-4 py-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-3xl font-extrabold leading-none">{avgRating ?? "—"}</p>
            <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Note moyenne</p>
          </div>
          <div className="rounded-2xl bg-[--card] px-4 py-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-lg font-extrabold leading-tight">{topGenre ?? "—"}</p>
            <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Genre favori</p>
          </div>
        </div>
      )}

      {/* Profile sub-nav */}
      <div className="flex gap-1 rounded-2xl bg-[--secondary] p-1">
        {[
          { label: "Bibliothèque", href: `/users/${username}/library` },
          { label: "Critiques", href: `/users/${username}/reviews` },
          { label: "Listes", href: `/users/${username}/lists` },
        ].map(({ label, href }) => {
          const isActive = href.includes("/library")
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex-1 rounded-xl py-2 text-center text-sm font-semibold transition-colors",
                isActive ? "bg-[--card] text-[--foreground]" : "text-[--muted-foreground] hover:text-[--foreground]"
              )}
              style={isActive ? { boxShadow: "var(--shadow-sm)" } : {}}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Search */}
      <LibrarySearchBar username={username} initialSearch={activeSearch} shelf={activeShelf} sort={activeSort} genre={activeGenre} />

      {/* Shelf tabs + sort */}
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

        {(activeShelf === "read" || activeShelf === "all") && totalCount > 0 && (
          <div className="flex items-center gap-1 rounded-lg bg-[--secondary] p-1 text-sm">
            <Link
              href={libraryHref(username, activeShelf, "recent", activeGenre, activeSearch)}
              className={cn("rounded-md px-3 py-1 font-semibold transition-colors", activeSort === "recent" ? "bg-[--card] text-[--foreground]" : "text-[--muted-foreground]")}
              style={activeSort === "recent" ? { boxShadow: "var(--shadow-sm)" } : {}}
            >
              Récents
            </Link>
            <Link
              href={libraryHref(username, activeShelf, "date_read", activeGenre, activeSearch)}
              className={cn("rounded-md px-3 py-1 font-semibold transition-colors", activeSort === "date_read" ? "bg-[--card] text-[--foreground]" : "text-[--muted-foreground]")}
              style={activeSort === "date_read" ? { boxShadow: "var(--shadow-sm)" } : {}}
            >
              Date de lecture
            </Link>
          </div>
        )}
      </div>

      {/* Genre filter chips — only shown when user has books with genres */}
      {genreList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {genreList.map((g) => {
            const isActive = g.slug === activeGenre
            return (
              <Link
                key={g.slug}
                href={libraryHref(username, activeShelf, activeSort, isActive ? "" : g.slug, activeSearch)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors"
                style={
                  isActive
                    ? { background: "var(--primary)", color: "#fff" }
                    : { background: "var(--secondary)", color: "var(--foreground)" }
                }
              >
                {g.label}
              </Link>
            )
          })}
        </div>
      )}

      {/* Book grid */}
      {!filteredBooks.length ? (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center" style={{ boxShadow: "var(--shadow)" }}>
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
          {isOwnProfile && activeShelf === "all" && !activeGenre && !activeSearch && (
            <p className="mt-2 text-sm text-[--muted-foreground]">
              <Link href="/books" className="font-semibold text-[--primary] hover:underline">Cherchez un livre</Link>{" "}pour commencer.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {filteredBooks.map((ub: any) => {
            const book = ub.book as any
            if (!book) return null
            const authors = (book.book_authors ?? [])
              .filter((ba: any) => ba.role === "author")
              .sort((a: any, b: any) => a.display_order - b.display_order)
              .map((ba: any) => ba.author?.name)
              .filter(Boolean)

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
                {ub.status === "read" && ub.finished_at && (
                  <p className="text-xs text-[--muted-foreground] mt-0.5">
                    {new Date(ub.finished_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
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
