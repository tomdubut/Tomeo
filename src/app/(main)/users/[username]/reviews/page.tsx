import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { BookOpen } from "lucide-react"

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .single()

  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: reviews } = await supabase
    .from("reviews")
    .select(`
      id, body, is_spoiler, created_at, updated_at, book_id,
      book:books(id, title, cover_url,
        book_authors(display_order, role, author:authors(name))
      )
    `)
    .eq("user_id", profile.id)
    .eq("is_private", false)
    .order("updated_at", { ascending: false })

  // Fetch ratings for these books
  const bookIds = (reviews ?? []).map((r) => r.book_id)
  const { data: ratings } = bookIds.length
    ? await supabase
        .from("ratings")
        .select("book_id, score")
        .eq("user_id", profile.id)
        .in("book_id", bookIds)
    : { data: [] }

  const ratingMap = Object.fromEntries((ratings ?? []).map((r) => [r.book_id, r.score]))
  const displayName = profile.display_name ?? profile.username
  const isOwn = currentUser?.id === profile.id

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">
        Critiques de{" "}
        <Link href={`/users/${username}`} className="hover:underline">
          {displayName}
        </Link>
      </h1>

      {!reviews?.length ? (
        <div className="rounded-xl border border-[--border] bg-[--card] p-12 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-[--muted-foreground]" />
          <p className="font-medium">
            {isOwn ? "Vous n'avez pas encore écrit de critique" : `${displayName} n'a pas encore écrit de critique`}
          </p>
          {isOwn && (
            <p className="mt-1 text-sm text-[--muted-foreground]">
              Ouvrez une fiche livre pour laisser votre avis.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {reviews.map((review) => {
            const book = review.book as any
            const score = ratingMap[review.book_id]
            const authors = (book?.book_authors ?? [])
              .filter((ba: any) => ba.role === "author")
              .sort((a: any, b: any) => a.display_order - b.display_order)
              .map((ba: any) => ba.author?.name)
              .filter(Boolean)

            return (
              <div key={review.id} className="rounded-xl border border-[--border] bg-[--card] p-5 space-y-4">
                {/* Book info */}
                <Link href={`/books/${book.id}`} className="flex gap-3 group">
                  <div className="w-12 aspect-[2/3] relative shrink-0 rounded overflow-hidden bg-[--secondary]">
                    {book.cover_url ? (
                      <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized sizes="48px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <BookOpen className="h-4 w-4 text-[--muted-foreground]" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm group-hover:underline">{book.title}</p>
                    {authors[0] && <p className="text-xs text-[--muted-foreground]">{authors[0]}</p>}
                  </div>
                  {score != null && (
                    <span className="ml-auto shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800 self-start">
                      {score}/10
                    </span>
                  )}
                </Link>

                {/* Review body */}
                <div className="text-sm leading-relaxed">
                  {review.is_spoiler ? (
                    <SpoilerText body={review.body} />
                  ) : (
                    <p className="whitespace-pre-wrap">{review.body}</p>
                  )}
                </div>

                <p className="text-xs text-[--muted-foreground]">
                  {new Date(review.updated_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SpoilerText({ body }: { body: string }) {
  "use client"
  // Simple server-rendered spoiler — revealed via CSS on hover/click
  return (
    <details>
      <summary className="cursor-pointer text-amber-600 text-xs">⚠ Contient des spoilers — cliquez pour révéler</summary>
      <p className="mt-2 whitespace-pre-wrap">{body}</p>
    </details>
  )
}
