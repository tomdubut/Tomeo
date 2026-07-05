import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { BookOpen, Users, Sparkles } from "lucide-react"
import UserAvatar from "@/components/ui/UserAvatar"
import { Button } from "@/components/ui/button"
import ReadingGoalWidget from "@/components/home/ReadingGoalWidget"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, reading_goal")
    .eq("id", user.id)
    .single()
  if (!profile) redirect("/onboarding")

  const thisYear = new Date().getFullYear()
  const yearStart = `${thisYear}-01-01`

  // Round 1 — parallel: following IDs + lightweight user book scan
  const [{ data: followRows }, { data: allUserBooks }] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
    supabase.from("user_books").select("book_id, status, finished_at").eq("user_id", user.id),
  ])

  const followingIds = followRows?.map((r) => r.following_id) ?? []
  const allUserBookIds = new Set((allUserBooks ?? []).map((r) => r.book_id))
  const readBookIds = (allUserBooks ?? []).filter((r) => r.status === "read").map((r) => r.book_id)
  const currentlyReadingIds = (allUserBooks ?? []).filter((r) => r.status === "currently_reading").map((r) => r.book_id)
  const booksThisYear = (allUserBooks ?? []).filter((r) => r.status === "read" && r.finished_at && r.finished_at >= yearStart).length
  const totalRead = readBookIds.length

  // Round 2 — parallel: currently reading books + community activity + top genres
  const [{ data: currentlyReadingRaw }, { data: communityRaw }, { data: topGenreRows }] = await Promise.all([
    currentlyReadingIds.length
      ? supabase
          .from("user_books")
          .select("book_id, book:books(id, title, cover_url, avg_rating, book_authors(display_order, role, author:authors(name)))")
          .eq("user_id", user.id)
          .eq("status", "currently_reading")
      : Promise.resolve({ data: [] }),

    followingIds.length
      ? supabase
          .from("user_books")
          .select("book_id, status, updated_at, user_id, profile:profiles!user_id(username, display_name, avatar_url, profile_color)")
          .in("user_id", followingIds)
          .in("status", ["currently_reading", "read"])
          .order("updated_at", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),

    readBookIds.length
      ? supabase
          .from("book_genres")
          .select("genre_id, genres(slug, label, type)")
          .in("book_id", readBookIds)
      : Promise.resolve({ data: [] }),
  ])

  // Derive top 3 genre IDs from user's reading history
  const genreCount = new Map<number, { slug: string; label: string; count: number }>()
  for (const row of topGenreRows ?? []) {
    const g = row.genres as unknown as { slug: string; label: string; type: string } | null
    if (!g || g.type !== "genre") continue
    const prev = genreCount.get(row.genre_id) ?? { slug: g.slug, label: g.label, count: 0 }
    genreCount.set(row.genre_id, { ...prev, count: prev.count + 1 })
  }
  const topGenresSorted = Array.from(genreCount.entries()).sort((a, b) => b[1].count - a[1].count)
  const topGenreIds = topGenresSorted.slice(0, 3).map(([id]) => id)
  const topGenreLabelById = new Map(topGenresSorted.map(([id, g]) => [id, g.label]))

  // Group community activity by book
  type CommunityBook = {
    book_id: string
    readers: Array<{ username: string; display_name: string | null; avatar_url: string | null; profile_color: string | null }>
    hasCurrentlyReading: boolean
    latest: string
  }
  const communityByBook = new Map<string, CommunityBook>()
  for (const row of communityRaw ?? []) {
    if (allUserBookIds.has(row.book_id)) continue
    const p = row.profile as unknown as { username: string; display_name: string | null; avatar_url: string | null; profile_color: string | null } | null
    if (!p) continue
    const existing = communityByBook.get(row.book_id)
    if (existing) {
      if (!existing.readers.find((r) => r.username === p.username)) existing.readers.push(p)
      if (row.status === "currently_reading") existing.hasCurrentlyReading = true
    } else {
      communityByBook.set(row.book_id, {
        book_id: row.book_id,
        readers: [p],
        hasCurrentlyReading: row.status === "currently_reading",
        latest: row.updated_at,
      })
    }
  }
  const communityBookIds = Array.from(communityByBook.values())
    .sort((a, b) => b.readers.length - a.readers.length || b.latest.localeCompare(a.latest))
    .slice(0, 12)
    .map((b) => b.book_id)

  // Round 3 — parallel: community book covers + personalized recommendations
  const [{ data: communityBooksRaw }, { data: recommendedBooksRaw }]: [any, any] = await Promise.all([
    communityBookIds.length
      ? supabase
          .from("books")
          .select("id, title, cover_url, avg_rating")
          .in("id", communityBookIds)
      : Promise.resolve({ data: [] }),

    topGenreIds.length
      ? supabase
          .from("books")
          .select("id, title, cover_url, avg_rating, book_genres!inner(genre_id)")
          .in("book_genres.genre_id", topGenreIds)
          .not("id", "in", `(${Array.from(allUserBookIds).join(",") || "null"})`)
          .not("avg_rating", "is", null)
          .order("avg_rating", { ascending: false })
          .limit(18)
      : supabase
          .from("books")
          .select("id, title, cover_url, avg_rating, book_genres(genre_id)")
          .not("avg_rating", "is", null)
          .order("avg_rating", { ascending: false })
          .limit(18) as any,
  ])

  // Reorder community books to match ranked order
  const communityBooksMap = new Map((communityBooksRaw ?? []).map((b: any) => [b.id, b]))
  const communityBooks = communityBookIds
    .map((id) => ({ book: communityBooksMap.get(id) as any, meta: communityByBook.get(id)! }))
    .filter((b) => !!b.book)

  // Deduplicate recommended books and attach matching genre label
  const seenRec = new Set<string>()
  type RecommendedBook = { id: string; title: string; cover_url: string | null; avg_rating: number | null; genreLabel: string | undefined }
  const recommendedBooks: RecommendedBook[] = (recommendedBooksRaw ?? [])
    .filter((b: any) => {
      if (seenRec.has(b.id)) return false
      seenRec.add(b.id)
      return true
    })
    .slice(0, 12)
    .map((b: any) => {
      const genres: Array<{ genre_id: number }> = b.book_genres ?? []
      const matchingGenreId = genres.find((g) => topGenreLabelById.has(g.genre_id))?.genre_id
      return {
        id: b.id as string,
        title: b.title as string,
        cover_url: b.cover_url as string | null,
        avg_rating: b.avg_rating as number | null,
        genreLabel: matchingGenreId ? topGenreLabelById.get(matchingGenreId) : undefined,
      }
    })

  const currentlyReading = (currentlyReadingRaw ?? []) as unknown as Array<{
    book_id: string
    book: { id: string; title: string; cover_url: string | null; avg_rating: number | null; book_authors: Array<{ display_order: number; role: string; author: { name: string } | null }> } | null
  }>

  const displayName = profile.display_name ?? profile.username
  const hasStats = totalRead > 0

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-10">

      {/* Greeting */}
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Bonjour, {displayName} 👋
        </h1>

        <ReadingGoalWidget
          currentGoal={(profile as any).reading_goal ?? null}
          booksRead={booksThisYear}
          year={thisYear}
        />
      </div>

      {/* Currently reading */}
      {currentlyReading.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">En cours de lecture</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {currentlyReading.map(({ book }) => {
              if (!book) return null
              const authors = (book.book_authors ?? [])
                .filter((ba) => ba.role === "author")
                .sort((a, b) => a.display_order - b.display_order)
                .map((ba) => ba.author?.name)
                .filter(Boolean)
              return (
                <Link key={book.id} href={`/books/${book.id}`} className="group shrink-0 w-32">
                  <div className="aspect-[2/3] relative rounded-xl overflow-hidden mb-2" style={{ background: "var(--secondary)", boxShadow: "var(--shadow-sm)" }}>
                    {book.cover_url ? (
                      <Image src={book.cover_url} alt={book.title} fill className="object-cover group-hover:opacity-90 transition-opacity" sizes="128px" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <BookOpen className="h-8 w-8 text-[--muted-foreground]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold line-clamp-2 group-hover:underline">{book.title}</p>
                  {authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{authors[0]}</p>}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Community — what people you follow are reading */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Dans votre communauté</h2>
          <Link href="/feed" className="text-sm font-semibold text-[--muted-foreground] hover:text-[--foreground] transition-colors">
            Voir le fil →
          </Link>
        </div>

        {communityBooks.length === 0 ? (
          <div className="rounded-2xl bg-[--card] p-8 text-center">
            <Users className="h-8 w-8 text-[--muted-foreground] mx-auto mb-3" />
            <p className="text-sm font-semibold mb-1">Personne à suivre pour l&apos;instant</p>
            <p className="text-sm text-[--muted-foreground] mb-4">Suivez des lecteurs pour voir ce qu&apos;ils lisent.</p>
            <Button asChild size="sm"><Link href="/users">Découvrir des lecteurs</Link></Button>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {communityBooks.map(({ book, meta }) => (
              <Link key={book.id} href={`/books/${book.id}`} className="group shrink-0 w-28">
                <div className="aspect-[2/3] relative rounded-xl overflow-hidden mb-2" style={{ background: "var(--secondary)", boxShadow: "var(--shadow-sm)" }}>
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={book.title} fill className="object-cover group-hover:opacity-90 transition-opacity" sizes="112px" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-6 w-6 text-[--muted-foreground]" />
                    </div>
                  )}
                  {/* Reader avatars */}
                  <div className="absolute bottom-1.5 left-1.5 flex -space-x-1.5">
                    {meta.readers.slice(0, 3).map((r) => (
                      <div key={r.username} className="h-5 w-5 rounded-full ring-1 ring-[--card] overflow-hidden shrink-0">
                        <UserAvatar profile={r} className="h-5 w-5" />
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs font-semibold line-clamp-2 group-hover:underline leading-tight">{book.title}</p>
                <p className="text-xs text-[--muted-foreground] mt-0.5">
                  {meta.readers.length === 1
                    ? meta.readers[0].display_name ?? meta.readers[0].username
                    : `${meta.readers[0].display_name ?? meta.readers[0].username} +${meta.readers.length - 1}`}
                </p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--primary)" }}>
                  {meta.hasCurrentlyReading ? "lit en ce moment" : "a lu"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pour vous — personalized recommendations */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[--primary]" />
          <h2 className="text-lg font-bold">Pour vous</h2>
          {topGenreIds.length > 0 && (
            <span className="text-sm text-[--muted-foreground]">
              — basé sur vos genres favoris
            </span>
          )}
        </div>

        {recommendedBooks.length === 0 ? (
          <div className="rounded-2xl bg-[--card] p-8 text-center">
            <Sparkles className="h-8 w-8 text-[--muted-foreground] mx-auto mb-3" />
            <p className="text-sm font-semibold mb-1">Ajoutez des livres lus pour obtenir des recommandations</p>
            <p className="text-sm text-[--muted-foreground] mb-4">Plus vous lisez, plus les suggestions sont précises.</p>
            <Button asChild size="sm" variant="outline"><Link href="/books">Explorer le catalogue</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {recommendedBooks.map((book) => (
              <Link key={book.id} href={`/books/${book.id}`} className="group">
                <div className="aspect-[2/3] relative rounded-xl overflow-hidden mb-2" style={{ background: "var(--secondary)", boxShadow: "var(--shadow-sm)" }}>
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={book.title} fill className="object-cover group-hover:opacity-90 transition-opacity" sizes="(max-width: 640px) 33vw, 20vw" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-6 w-6 text-[--muted-foreground]" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold line-clamp-2 group-hover:underline leading-tight">{book.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {book.genreLabel && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                      {book.genreLabel}
                    </span>
                  )}
                  {book.avg_rating && (
                    <span className="text-xs text-[--primary] font-semibold">★ {book.avg_rating}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
