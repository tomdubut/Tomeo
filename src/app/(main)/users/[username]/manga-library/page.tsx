
import { notFound } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileSubNav from "@/components/profile/ProfileSubNav"
import MangaCard from "@/components/manga/MangaCard"
import { BookOpen } from "lucide-react"

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ shelf?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `@${username} — Manga — Tomesie` }
}

const SHELVES = [
  { key: "all", label: "Tous" },
  { key: "read", label: "Lus" },
  { key: "currently_reading", label: "En cours" },
  { key: "want_to_read", label: "À lire" },
] as const

type ShelfKey = (typeof SHELVES)[number]["key"]

export default async function UserMangaLibraryPage({ params, searchParams }: Props) {
  const { username } = await params
  const { shelf } = await searchParams
  const activeShelf: ShelfKey = (SHELVES.map(s => s.key) as string[]).includes(shelf ?? "") ? (shelf as ShelfKey) : "all"

  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // Fetch profile
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single()

  if (!profile) notFound()

  // Follower/following counts
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    admin.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    admin.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
  ])

  let isFollowing = false
  if (currentUser && currentUser.id !== profile.id) {
    const { data: followRow } = await admin
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .single()
    isFollowing = !!followRow
  }

  // Fetch all user_manga for this profile
  const { data: allRows } = await admin
    .from("user_manga")
    .select("manga_id, status, volumes_read, updated_at, manga:manga_series(id, title_fr, author, cover_url, volume_count)")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false })

  const rows = allRows ?? []

  // Shelf counts
  const countByShelf: Record<string, number> = { all: rows.length }
  for (const r of rows) {
    countByShelf[r.status] = (countByShelf[r.status] ?? 0) + 1
  }

  // Filter by shelf
  const filtered = activeShelf === "all" ? rows : rows.filter(r => r.status === activeShelf)

  // Book count for header
  const { count: bookCount } = await admin
    .from("user_books")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)

  function hrefFor(s: string) {
    return s === "all" ? `/users/${username}/manga-library` : `/users/${username}/manga-library?shelf=${s}`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 py-8">
      <ProfileHeader
        profile={profile}
        isOwnProfile={currentUser?.id === profile.id}
        currentUserId={currentUser?.id ?? null}
        isFollowing={isFollowing}
        bookCount={bookCount ?? 0}
        followerCount={followersCount ?? 0}
        followingCount={followingCount ?? 0}
      />

      <ProfileSubNav username={username} hasManga={rows.length > 0} />

      {/* Shelf tabs */}
      <div className="flex gap-1 rounded-2xl bg-[--secondary] p-1">
        {SHELVES.map(({ key, label }) => {
          const count = countByShelf[key] ?? 0
          const active = activeShelf === key
          return (
            <a
              key={key}
              href={hrefFor(key)}
              className={`flex-1 text-center py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
                active ? "text-[--foreground]" : "text-[--muted-foreground] hover:text-[--foreground]"
              }`}
              style={active ? { background: "var(--card)" } : undefined}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${active ? "bg-[--border] text-[--foreground]" : "bg-[--border] text-[--muted-foreground]"}`}>
                  {count}
                </span>
              )}
            </a>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <BookOpen className="h-10 w-10 text-[--muted-foreground] opacity-40" />
          <p className="text-sm text-[--muted-foreground]">
            {activeShelf === "all" ? "Aucun manga dans la bibliothèque." : "Aucun manga dans cette catégorie."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {filtered.map((row) => {
            const manga = row.manga as any
            if (!manga) return null
            return (
              <MangaCard
                key={manga.id}
                manga={manga}
                status={row.status as any}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
