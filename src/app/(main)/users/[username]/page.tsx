import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileSubNav from "@/components/profile/ProfileSubNav"
import BookCover from "@/components/books/BookCover"
import { BookOpen, Star, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `@${username} — Tomesie` }
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params
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
    const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", currentUser.id).eq("following_id", profile.id).single()
    isFollowing = !!data
  }

  const thisYear = new Date().getFullYear()
  const yearStart = `${thisYear}-01-01`

  const [
    { data: favouriteRows },
    { count: bookCount },
    { count: followerCount },
    { count: followingCount },
    { data: allUserBooks },
    { data: recentlyAdded },
  ] = await Promise.all([
    supabase
      .from("profile_favourite_books")
      .select("position, book:books(id, title, cover_url, isbn_13, google_books_id, book_authors(role, display_order, author:authors(name)))")
      .eq("user_id", profile.id)
      .order("position"),
    supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    supabase.from("user_books").select("book_id, status, finished_at").eq("user_id", profile.id),
    supabase
      .from("user_books")
      .select("book_id, status, updated_at, book:books(id, title, cover_url, book_authors(role, display_order, author:authors(name)))")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(4),
  ])

  // Stats
  const allBookIds = (allUserBooks ?? []).map((r: any) => r.book_id)
  const readBookIds = (allUserBooks ?? []).filter((r: any) => r.status === "read").map((r: any) => r.book_id)
  const booksThisYear = (allUserBooks ?? []).filter((r: any) => r.status === "read" && r.finished_at && r.finished_at >= yearStart).length

  const [{ data: userRatings }, { data: bgRows }] = await Promise.all([
    readBookIds.length
      ? supabase.from("ratings").select("book_id, score").eq("user_id", profile.id).in("book_id", readBookIds)
      : Promise.resolve({ data: [] }),
    allBookIds.length
      ? supabase.from("book_genres").select("book_id, genre_id, genres(id, slug, label, type)").in("book_id", allBookIds)
      : Promise.resolve({ data: [] }),
  ])

  const avgRating = (userRatings ?? []).length
    ? Math.round(((userRatings ?? []).reduce((sum: number, r: any) => sum + Number(r.score), 0) / (userRatings ?? []).length) * 10) / 10
    : null

  // Top genre
  const HIDDEN_SLUGS = new Set(["litterature"])
  let topGenre: string | null = null
  if ((bgRows ?? []).length) {
    const readBookIdSet = new Set(readBookIds)
    const readGenreCount = new Map<number, { label: string; count: number }>()
    for (const row of bgRows ?? []) {
      const g = row.genres as unknown as { id: number; slug: string; label: string; type: string | null } | null
      if (!g || HIDDEN_SLUGS.has(g.slug) || (g.type ?? "genre") !== "genre") continue
      if (readBookIdSet.has(row.book_id)) {
        const prev = readGenreCount.get(g.id) ?? { label: g.label, count: 0 }
        readGenreCount.set(g.id, { label: g.label, count: prev.count + 1 })
      }
    }
    const topEntry = Array.from(readGenreCount.values()).sort((a, b) => b.count - a.count)[0]
    topGenre = topEntry?.label ?? null
  }

  // Recent activity: recently added + recent ratings + recent reviews (merged, max 4)
  const recentBookIds = (recentlyAdded ?? []).map((r: any) => r.book_id)

  const [{ data: recentRatings }, { data: recentReviews }] = await Promise.all([
    recentBookIds.length
      ? supabase.from("ratings").select("book_id, score, updated_at").eq("user_id", profile.id).in("book_id", recentBookIds).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    recentBookIds.length
      ? supabase.from("reviews").select("book_id, updated_at").eq("user_id", profile.id).in("book_id", recentBookIds).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const ratingMap = Object.fromEntries((recentRatings ?? []).map((r: any) => [r.book_id, r.score]))
  const reviewedBookIds = new Set((recentReviews ?? []).map((r: any) => r.book_id))

  // Favourite slots
  const slots = ([1, 2, 3, 4] as const).map((pos) => {
    const row = (favouriteRows ?? []).find((r: any) => r.position === pos)
    const b = row?.book as any
    return {
      position: pos,
      book: b ? {
        id: b.id,
        title: b.title,
        cover_url: b.cover_url,
        isbn_13: b.isbn_13,
        google_books_id: b.google_books_id,
        authors: (b.book_authors ?? [])
          .filter((ba: any) => ba.role === "author")
          .sort((a: any, z: any) => a.display_order - z.display_order)
          .map((ba: any) => ba.author?.[0]?.name)
          .filter(Boolean),
      } : null,
    }
  })

  const hasFavourites = slots.some((s) => s.book !== null)
  const hasStats = booksThisYear > 0 || readBookIds.length > 0 || avgRating !== null || topGenre !== null
  const displayName = profile.display_name ?? profile.username

  const shelfLabel: Record<string, string> = {
    read: "A lu",
    currently_reading: "En cours de lecture",
    want_to_read: "Veut lire",
  }

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
      />

      <div className="rounded-2xl bg-[--card] p-6 sm:p-8 space-y-8">
        <ProfileSubNav username={username} />

        {/* Stats */}
        {hasStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "var(--secondary)" }}>
              <p className="text-3xl font-semibold leading-none">{booksThisYear}</p>
              <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Lus en {thisYear}</p>
            </div>
            <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "var(--secondary)" }}>
              <p className="text-3xl font-semibold leading-none">{readBookIds.length}</p>
              <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Lus au total</p>
            </div>
            <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "var(--secondary)" }}>
              <p className="text-3xl font-semibold leading-none">{avgRating ?? "—"}</p>
              <p className="text-xs text-[--muted-foreground] mt-1.5 font-medium">Note moyenne</p>
            </div>
            <div
              className="rounded-2xl px-4 py-4 text-center"
              style={{
                background: topGenre ? "var(--secondary-accent)" : "var(--secondary)",
                color: topGenre ? "var(--secondary-accent-foreground)" : "var(--foreground)",
              }}
            >
              <p className="text-lg font-semibold leading-tight">{topGenre ?? "—"}</p>
              <p className={cn("text-xs mt-1.5 font-medium", topGenre ? "text-white/75" : "text-[--muted-foreground]")}>Genre favori</p>
            </div>
          </div>
        )}

        {/* Favourite books */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[--muted-foreground] uppercase tracking-wide">Livres favoris</p>
            {isOwnProfile && (
              <Link href="/settings" className="text-xs text-[--muted-foreground] hover:underline">Modifier</Link>
            )}
          </div>

          {hasFavourites ? (
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {slots.map((slot) => (
                <div key={slot.position}>
                  {slot.book ? (
                    <Link href={`/books/${slot.book.id}`} className="group block">
                      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary]" style={{ boxShadow: "var(--shadow-sm)" }}>
                        <BookCover
                          src={slot.book.cover_url}
                          title={slot.book.title}
                          author={slot.book.authors[0]}
                          isbn={slot.book.isbn_13 ?? undefined}
                          googleBooksId={slot.book.google_books_id ?? undefined}
                          className="w-full h-full group-hover:opacity-80 transition-opacity"
                          sizes="200px"
                        />
                      </div>
                      <p className="mt-1.5 text-xs font-semibold line-clamp-2 group-hover:underline">{slot.book.title}</p>
                    </Link>
                  ) : (
                    <div className="aspect-[2/3] w-full rounded-xl bg-[--secondary] border border-dashed border-[--border]" />
                  )}
                </div>
              ))}
            </div>
          ) : isOwnProfile ? (
            <div className="rounded-2xl bg-[--secondary] px-6 py-8 text-center">
              <BookOpen className="h-7 w-7 text-[--muted-foreground] mx-auto mb-2" />
              <p className="text-sm text-[--muted-foreground]">Ajoutez vos livres favoris depuis vos paramètres.</p>
              <Link href="/settings" className="mt-3 inline-block text-sm font-semibold hover:underline" style={{ color: "#e8650a" }}>
                Modifier mes favoris →
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-[--secondary] px-6 py-8 text-center">
              <BookOpen className="h-7 w-7 text-[--muted-foreground] mx-auto mb-2" />
              <p className="text-sm text-[--muted-foreground]">Aucun livre favori pour l&apos;instant.</p>
            </div>
          )}
        </div>

        {/* Recent activity */}
        {(recentlyAdded ?? []).length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[--muted-foreground] uppercase tracking-wide">Activité récente</p>
            <div className="space-y-2">
              {(recentlyAdded ?? []).map((row: any) => {
                const book = row.book as any
                if (!book) return null
                const authors = (book.book_authors ?? [])
                  .filter((ba: any) => ba.role === "author")
                  .sort((a: any, z: any) => a.display_order - z.display_order)
                  .map((ba: any) => ba.author?.[0]?.name)
                  .filter(Boolean)
                const rating = ratingMap[row.book_id]
                const hasReview = reviewedBookIds.has(row.book_id)

                return (
                  <Link key={row.book_id} href={`/books/${book.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[--secondary] transition-colors group">
                    <div className="w-9 aspect-[2/3] relative shrink-0 rounded-lg overflow-hidden bg-[--secondary]">
                      {book.cover_url ? (
                        <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized sizes="36px" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-3 w-3 text-[--muted-foreground]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:underline">{book.title}</p>
                      {authors[0] && <p className="text-xs text-[--muted-foreground] truncate">{authors[0]}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {rating != null && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <Star className="h-3 w-3 fill-current" />{rating}/10
                        </span>
                      )}
                      {hasReview && <MessageSquare className="h-3.5 w-3.5 text-[--muted-foreground]" />}
                      <span className="text-xs text-[--muted-foreground] bg-[--secondary] rounded-lg px-2 py-0.5">
                        {shelfLabel[row.status] ?? row.status}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state for visitors when no activity */}
        {!hasStats && (recentlyAdded ?? []).length === 0 && !isOwnProfile && (
          <div className="py-6 text-center">
            <p className="text-sm text-[--muted-foreground]">{displayName} n&apos;a pas encore de livres dans sa bibliothèque.</p>
          </div>
        )}
      </div>
    </div>
  )
}
