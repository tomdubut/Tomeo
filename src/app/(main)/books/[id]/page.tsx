import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import BookCover from "@/components/books/BookCover"
import AddToLibraryButton from "@/components/books/AddToLibraryButton"
import AddToListButton from "@/components/lists/AddToListButton"
import ReviewCard from "@/components/reviews/ReviewCard"
import CommentsSection from "@/components/reviews/CommentsSection"
import ReviewFormSection from "./ReviewFormSection"
import { Star, BookOpen, CalendarDays, Building2 } from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("books").select("title").eq("id", id).single()
  return { title: data ? `${data.title} — Tomeo` : "Livre — Tomeo" }
}

export default async function BookDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: book }, { data: { user } }] = await Promise.all([
    supabase
      .from("books")
      .select(`*, publisher:publishers(name), book_authors(role, display_order, author:authors(id, name))`)
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!book) notFound()

  // User's library entry, rating, lists
  let userBook: { status: string; finished_at: string | null } | null = null
  let userRating: number | null = null
  let userReview: { id: string; body: string; is_spoiler: boolean } | null = null
  let userLists: { id: string; title: string; is_public: boolean }[] = []
  let bookInListIds: string[] = []

  if (user) {
    const [ubRes, ratingRes, reviewRes, listsRes, bookListsRes] = await Promise.all([
      supabase
        .from("user_books")
        .select("status, finished_at")
        .eq("user_id", user.id)
        .eq("book_id", id)
        .single(),
      supabase
        .from("ratings")
        .select("score")
        .eq("user_id", user.id)
        .eq("book_id", id)
        .single(),
      supabase
        .from("reviews")
        .select("id, body, is_spoiler")
        .eq("user_id", user.id)
        .eq("book_id", id)
        .single(),
      supabase
        .from("lists")
        .select("id, title, is_public")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      // list_ids fetched after listsRes resolves — handled below
      Promise.resolve({ data: [] as { list_id: string }[] }),
    ])
    userBook = ubRes.data
    userRating = ratingRes.data?.score ?? null
    userReview = reviewRes.data
    userLists = listsRes.data ?? []

    // Now fetch which of the user's lists contain this book
    if (userLists.length > 0) {
      const { data: inLists } = await supabase
        .from("list_books")
        .select("list_id")
        .eq("book_id", id)
        .in("list_id", userLists.map((l) => l.id))
      bookInListIds = (inLists ?? []).map((r) => r.list_id)
    }
  }

  // All reviews for this book (excluding current user — shown separately above)
  const { data: reviews } = await supabase
    .from("reviews")
    .select(`
      id, body, is_spoiler, created_at, updated_at, book_id, user_id,
      profile:profiles!user_id(username, display_name, avatar_url)
    `)
    .eq("book_id", id)
    .eq("is_private", false)
    .neq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(20)

  // Join ratings into reviews
  const reviewUserIds = (reviews ?? []).map((r) => r.user_id)
  const { data: otherRatings } = reviewUserIds.length
    ? await supabase
        .from("ratings")
        .select("user_id, score")
        .eq("book_id", id)
        .in("user_id", reviewUserIds)
    : { data: [] }

  const ratingMap = Object.fromEntries((otherRatings ?? []).map((r) => [r.user_id, r.score]))

  // Comments for all reviews on this page
  const reviewIds = (reviews ?? []).map((r) => r.id)
  const { data: allComments } = reviewIds.length
    ? await supabase
        .from("comments")
        .select(`id, body, created_at, user_id, review_id, profile:profiles!user_id(username, display_name, avatar_url)`)
        .in("review_id", reviewIds)
        .order("created_at", { ascending: true })
    : { data: [] }

  const commentsByReview: Record<string, any[]> = {}
  for (const c of allComments ?? []) {
    if (!commentsByReview[c.review_id]) commentsByReview[c.review_id] = []
    commentsByReview[c.review_id].push(c)
  }

  const authors = (book.book_authors ?? [])
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .filter((ba: any) => ba.role === "author")
    .map((ba: any) => ba.author)

  const translators = (book.book_authors ?? [])
    .filter((ba: any) => ba.role === "translator")
    .map((ba: any) => ba.author)

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Book header */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        {/* Cover */}
        <div className="shrink-0">
          <div className="w-36 sm:w-48 aspect-[2/3] relative rounded-2xl overflow-hidden shadow-lg">
            <BookCover src={book.cover_url} title={book.title} className="w-full h-full" sizes="192px" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 w-full text-center sm:text-left space-y-3">
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{book.title}</h1>
            {book.subtitle && <p className="text-base text-[--muted-foreground] mt-1">{book.subtitle}</p>}
          </div>

          {authors.length > 0 && (
            <p className="text-base">
              <span className="text-[--muted-foreground]">Par </span>
              {authors.map((a: any, i: number) => (
                <span key={a.id}>
                  <span className="font-semibold">{a.name}</span>
                  {i < authors.length - 1 && ", "}
                </span>
              ))}
            </p>
          )}

          {translators.length > 0 && (
            <p className="text-sm text-[--muted-foreground]">
              Traduit par {translators.map((t: any) => t.name).join(", ")}
            </p>
          )}

          {/* Metadata chips */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 text-sm">
            {book.avg_rating && (
              <span className="flex items-center gap-1 rounded-xl bg-[--secondary] px-3 py-1 font-medium">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {Number(book.avg_rating).toFixed(1)}/10
                <span className="text-[--muted-foreground] font-normal">({book.rating_count})</span>
              </span>
            )}
            {book.page_count && (
              <span className="flex items-center gap-1 rounded-xl bg-[--secondary] px-3 py-1 text-[--muted-foreground]">
                <BookOpen className="h-3.5 w-3.5" />
                {book.page_count} p.
              </span>
            )}
            {book.published_date && (
              <span className="flex items-center gap-1 rounded-xl bg-[--secondary] px-3 py-1 text-[--muted-foreground]">
                <CalendarDays className="h-3.5 w-3.5" />
                {book.published_date.slice(0, 4)}
              </span>
            )}
            {book.publisher?.name && (
              <span className="flex items-center gap-1 rounded-xl bg-[--secondary] px-3 py-1 text-[--muted-foreground]">
                <Building2 className="h-3.5 w-3.5" />
                {book.publisher.name}
              </span>
            )}
          </div>

          {/* Action buttons */}
          {user && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1 w-full sm:w-auto">
              <AddToLibraryButton
                bookId={book.id}
                initialStatus={(userBook?.status as any) ?? null}
                initialFinishedAt={userBook?.finished_at ?? null}
              />
              <AddToListButton
                bookId={book.id}
                lists={userLists}
                initialListIds={bookInListIds}
              />
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Résumé</h2>
          <div
            className="text-sm leading-relaxed prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: book.description }}
          />
        </div>
      )}

      {/* Rating + review section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Critiques</h2>

        {user ? (
          <ReviewFormSection
            bookId={book.id}
            initialScore={userRating}
            initialReview={userReview}
            username={user.id}
          />
        ) : (
          <p className="text-sm text-[--muted-foreground]">
            <a href="/login" className="underline underline-offset-4">Connectez-vous</a> pour laisser une critique.
          </p>
        )}

        {reviews && reviews.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-medium text-[--muted-foreground]">
              {reviews.length} critique{reviews.length > 1 ? "s" : ""} de lecteurs
            </h3>
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl bg-[--card] p-5 space-y-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                <ReviewCard
                  review={{ ...r, profile: r.profile as any, score: ratingMap[r.user_id] ?? null }}
                  currentUserId={user?.id}
                />
                <CommentsSection
                  reviewId={r.id}
                  bookId={id}
                  initialComments={commentsByReview[r.id] ?? []}
                  currentUserId={user?.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="pt-6 border-t border-[--border] grid grid-cols-2 gap-3 text-sm">
        {book.isbn_13 && (
          <div><span className="text-[--muted-foreground]">ISBN-13 </span><span className="font-mono">{book.isbn_13}</span></div>
        )}
        {book.isbn_10 && (
          <div><span className="text-[--muted-foreground]">ISBN-10 </span><span className="font-mono">{book.isbn_10}</span></div>
        )}
        {book.language && (
          <div><span className="text-[--muted-foreground]">Langue </span><span className="uppercase">{book.language}</span></div>
        )}
      </div>
    </div>
  )
}
