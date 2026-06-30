
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { BookOpen } from "lucide-react"
import { formatDate } from "@/lib/utils/date"
import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileSubNav from "@/components/profile/ProfileSubNav"
import type { BookSummary } from "@/lib/types"

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `Critiques de @${username} — Tomeo` }
}

export default async function UserReviewsPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase.from("profiles").select("*").eq("username", username).single()
  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const isOwn = currentUser?.id === profile.id

  let isFollowing = false
  if (currentUser && !isOwn) {
    const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", currentUser.id).eq("following_id", profile.id).single()
    isFollowing = !!data
  }

  const [{ count: bookCount }, { count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
  ])

  const { data: reviews } = await supabase
    .from("reviews")
    .select(`id, body, is_spoiler, created_at, updated_at, book_id, book:books(id, title, cover_url, book_authors(display_order, role, author:authors(name)))`)
    .eq("user_id", profile.id)
    .eq("is_private", false)
    .order("updated_at", { ascending: false })

  const bookIds = (reviews ?? []).map((r) => r.book_id)
  const { data: ratings } = bookIds.length
    ? await supabase.from("ratings").select("book_id, score").eq("user_id", profile.id).in("book_id", bookIds)
    : { data: [] }

  const ratingMap = Object.fromEntries((ratings ?? []).map((r) => [r.book_id, r.score]))
  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-4xl mx-auto">

      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwn}
        currentUserId={currentUser?.id ?? null}
        isFollowing={isFollowing}
        bookCount={bookCount ?? 0}
        followerCount={followerCount ?? 0}
        followingCount={followingCount ?? 0}
      />

      <div className="rounded-2xl bg-[--card] p-6 sm:p-8 space-y-6">
        <ProfileSubNav username={username} />

        {/* Reviews */}
        {!reviews?.length ? (
          <div className="px-6 py-10 sm:p-14 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
              <BookOpen className="h-8 w-8 text-[--primary]" />
            </div>
            <p className="text-lg font-bold">
              {isOwn ? "Vous n'avez pas encore écrit de critique" : `${displayName} n'a pas encore écrit de critique`}
            </p>
            {isOwn && (
              <p className="mt-2 text-sm text-[--muted-foreground]">
                Ouvrez une fiche livre pour laisser votre avis.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
            const book = review.book as unknown as BookSummary | null
            if (!book) return null
            const score = ratingMap[review.book_id]
            const authors = (book?.book_authors ?? [])
              .filter((ba) => ba.role === "author")
              .sort((a, b) => a.display_order - b.display_order)
              .map((ba) => ba.author?.name)
              .filter((n): n is string => !!n)

            return (
              <div key={review.id} className="rounded-2xl bg-[--secondary] p-5 space-y-4">
                <Link href={`/books/${book.id}`} className="flex gap-3 group items-start">
                  <div className="w-12 aspect-[2/3] relative shrink-0 rounded-xl overflow-hidden bg-[--secondary]">
                    {book.cover_url ? (
                      <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized sizes="48px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <BookOpen className="h-4 w-4 text-[--muted-foreground]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm group-hover:underline">{book.title}</p>
                    {authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5">{authors[0]}</p>}
                  </div>
                  {score != null && (
                    <span className="shrink-0 rounded-xl bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-800">
                      {score}/10
                    </span>
                  )}
                </Link>

                <div className="text-sm leading-relaxed">
                  {review.is_spoiler ? (
                    <details>
                      <summary className="cursor-pointer text-amber-600 text-xs font-semibold">⚠ Contient des spoilers — cliquez pour révéler</summary>
                      <p className="mt-2 whitespace-pre-wrap">{review.body}</p>
                    </details>
                  ) : (
                    <p className="whitespace-pre-wrap">{review.body}</p>
                  )}
                </div>

                <p className="text-xs text-[--muted-foreground]">
                  {formatDate(review.updated_at)}
                </p>
              </div>
            )
          })}
          </div>
        )}
      </div>
    </div>
  )
}
