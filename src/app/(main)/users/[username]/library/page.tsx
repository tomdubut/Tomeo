
import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { BookOpen } from "lucide-react"
import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileSubNav from "@/components/profile/ProfileSubNav"
import LibraryToolbar from "@/components/library/LibraryToolbar"
import LoadMoreLibrary from "@/components/library/LoadMoreLibrary"
import { Button } from "@/components/ui/button"
import type { LibraryBookCard } from "./actions"
import { SHELVES, libraryHref, parseLibraryFilters } from "@/lib/library/filters"

const PAGE_SIZE = 24

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ shelf?: string; sort?: string; format?: string; genres?: string; search?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `@${username} — Tomesie` }
}

export default async function UserLibraryPage({ params, searchParams }: Props) {
  const { username } = await params
  const filters = parseLibraryFilters(await searchParams)
  const { shelf: activeShelf, sort: activeSort, format: activeFormat, genres: activeGenres, search: activeSearch } = filters

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

  const [{ count: bookCount }, { count: followerCount }, { count: followingCount }, { count: mangaCount }] =
    await Promise.all([
      supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
      supabase.from("user_manga").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    ])

  const { data: allUserBooks } = await supabase
    .from("user_books")
    .select("book_id, status, finished_at, book:books(id, title)")
    .eq("user_id", profile.id)

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

  const ratingByBook: Record<string, number> = {}
  for (const r of userRatings ?? []) ratingByBook[r.book_id] = Number(r.score)

  const HIDDEN_SLUGS = new Set(["litterature"])
  let genreList: Array<{ id: number; slug: string; label: string; type: string }> = []
  let formatList: Array<{ id: number; slug: string; label: string; type: string }> = []
  let formatBookIdSet: Set<string> | null = null
  let genreBookIdSet: Set<string> | null = null

  if ((bgRows ?? []).length) {
    const seen = new Map<number, { id: number; slug: string; label: string; type: string }>()

    for (const row of bgRows ?? []) {
      const g = row.genres as unknown as { id: number; slug: string; label: string; type: string | null } | null
      if (!g || HIDDEN_SLUGS.has(g.slug)) continue
      if (!seen.has(g.id)) seen.set(g.id, { ...g, type: g.type ?? "genre" })
    }
    const allTags = Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, "fr"))
    genreList = allTags.filter((g) => g.type === "genre")
    formatList = allTags.filter((g) => g.type === "format")

    if (activeFormat) {
      const fId = allTags.find((g) => g.slug === activeFormat)?.id
      formatBookIdSet = fId !== undefined
        ? new Set((bgRows ?? []).filter((r) => r.genre_id === fId).map((r) => r.book_id))
        : new Set()
    }

    if (activeGenres.length) {
      const ids = new Set(
        activeGenres.map((s) => allTags.find((g) => g.slug === s)?.id).filter((id): id is number => id !== undefined)
      )
      genreBookIdSet = new Set((bgRows ?? []).filter((r) => ids.has(r.genre_id)).map((r) => r.book_id))
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

  let filteredRows = (allUserBooks ?? []).filter((row) => {
    if (activeShelf !== "all" && row.status !== activeShelf) return false
    if (formatBookIdSet && !formatBookIdSet.has(row.book_id)) return false
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
  }

  const orderedBookIds = filteredRows.map((r) => r.book_id)
  const firstPageIds = orderedBookIds.slice(0, PAGE_SIZE)

  let initialBooks: LibraryBookCard[] = []
  if (firstPageIds.length > 0) {
    let q = supabase
      .from("user_books")
      .select(`status, finished_at, book_id, book:books(id, title, cover_url, avg_rating, book_authors(display_order, role, author:authors(name)))`)
      .eq("user_id", profile.id)
      .in("book_id", firstPageIds)

    if (activeSort === "recent") q = q.order("updated_at", { ascending: false })

    const { data } = await q
    if (data) {
      const typed = data as unknown as LibraryBookCard[]
      if (activeSort === "recent") {
        initialBooks = typed.map((b) => ({ ...b, rating: ratingByBook[b.book_id] }))
      } else {
        const map = new Map(typed.map((b) => [b.book_id, b]))
        initialBooks = firstPageIds
          .map((id) => { const b = map.get(id); return b ? ({ ...b, rating: ratingByBook[id] } as LibraryBookCard) : null })
          .filter((b): b is LibraryBookCard => !!b)
      }
    }
  }

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="mx-auto max-w-4xl">

      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        currentUserId={currentUser?.id ?? null}
        isFollowing={isFollowing}
        bookCount={bookCount ?? 0}
        followerCount={followerCount ?? 0}
        followingCount={followingCount ?? 0}
      />

      <ProfileSubNav username={username} hasManga={(mangaCount ?? 0) > 0} />

      <div className="mt-5 space-y-5">
        <LibraryToolbar
          username={username}
          filters={filters}
          countByShelf={countByShelf}
          totalCount={totalCount}
          formatList={formatList}
          genreList={genreList}
        />

        {!initialBooks.length ? (
          <div className="px-6 py-10 sm:p-14 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-bold">
              {activeSearch
                ? `Aucun résultat pour "${activeSearch}"`
                : (activeFormat || activeGenres.length)
                  ? `Aucun livre dans ce filtre`
                  : isOwnProfile
                    ? activeShelf === "all" ? "Votre bibliothèque est vide" : `Aucun livre dans "${SHELVES.find((s) => s.key === activeShelf)?.label}"`
                    : `${displayName} n'a pas encore de livres ici`}
            </p>
            {isOwnProfile && !activeSearch && !activeFormat && !activeGenres.length && activeShelf === "all" && (
              <>
                <p className="mt-2 text-sm text-muted-foreground">Ajoutez des livres lus, en cours ou à lire pour les retrouver ici.</p>
                <div className="mt-5">
                  <Button asChild><Link href="/books">Parcourir le catalogue</Link></Button>
                </div>
              </>
            )}
            {isOwnProfile && (activeSearch || activeFormat || activeGenres.length > 0 || activeShelf !== "all") && (
              <div className="mt-5">
                <Button asChild variant="outline"><Link href={`/users/${username}/library`}>Voir toute la bibliothèque</Link></Button>
              </div>
            )}
          </div>
        ) : (
          <LoadMoreLibrary
            // new filters → new list (the list keeps its loaded pages in state, which would otherwise survive the navigation)
            key={libraryHref(username, filters)}
            initialBooks={initialBooks}
            profileId={profile.id}
            orderedBookIds={orderedBookIds}
            ratingByBook={ratingByBook}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>
    </div>
  )
}

