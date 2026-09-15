import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileSubNav from "@/components/profile/ProfileSubNav"
import BookCover from "@/components/books/BookCover"
import { BookOpen } from "lucide-react"

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

  const [
    { data: favouriteRows },
    { count: bookCount },
    { count: followerCount },
    { count: followingCount },
  ] = await Promise.all([
    supabase
      .from("profile_favourite_books")
      .select("position, book:books(id, title, cover_url, isbn_13, google_books_id, book_authors(role, display_order, author:authors(name)))")
      .eq("user_id", profile.id)
      .order("position"),
    supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
  ])

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

      <div className="rounded-2xl bg-[--card] p-6 sm:p-8 space-y-6">
        <ProfileSubNav username={username} />

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
      </div>
    </div>
  )
}
