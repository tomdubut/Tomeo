
import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getBookDetail, getCommunityReviews } from "@/lib/supabase/queries"
import BookCover from "@/components/books/BookCover"
import AddToLibraryButton from "@/components/books/AddToLibraryButton"
import AddToListButton from "@/components/lists/AddToListButton"
import BookActionBar from "@/components/books/BookActionBar"
import BackButton from "@/components/ui/BackButton"
import RatingSection from "@/components/books/RatingSection"
import ReadingProgress from "@/components/books/ReadingProgress"
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

  const [book, { data: { user } }] = await Promise.all([
    getBookDetail(id),
    supabase.auth.getUser(),
  ])

  if (!book) notFound()

  // User's library entry, rating, lists
  let userBook: { status: string; finished_at: string | null; current_page: number | null } | null = null
  let userRating: number | null = null
  let userReview: { id: string; body: string; is_spoiler: boolean; is_private: boolean } | null = null
  let userLists: { id: string; title: string; is_public: boolean }[] = []
  let bookInListIds: string[] = []

  let currentUserProfile: { username: string; display_name: string | null; avatar_url: string | null } | null = null

  if (user) {
    const [ubRes, ratingRes, reviewRes, listsRes, bookListsRes, profileRes] = await Promise.all([
      supabase
        .from("user_books")
        .select("status, finished_at, current_page")
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
        .select("id, body, is_spoiler, is_private")
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
      supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).single(),
    ])
    userBook = ubRes.data
    userRating = ratingRes.data?.score ?? null
    userReview = reviewRes.data
    userLists = listsRes.data ?? []
    currentUserProfile = profileRes.data ?? null

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

  // Community reviews + ratings + comments (cached, excludes current user)
  const { reviews, ratingMap, commentsByReview } = await getCommunityReviews(id, user?.id ?? "")

  // Recommendations: other books sharing the most genres with this one (Genre tags only, not Format)
  const { data: thisBookGenres } = await supabase.from("book_genres").select("genre_id, genres(type)").eq("book_id", id)
  const genreIds = (thisBookGenres ?? [])
    .filter((r: any) => (r.genres?.type ?? "genre") === "genre")
    .map((r) => r.genre_id)

  let recommendations: any[] = []
  if (genreIds.length > 0) {
    const [{ data: sharedRows }, { data: ownedBooks }] = await Promise.all([
      supabase.from("book_genres").select("book_id, genre_id").in("genre_id", genreIds).neq("book_id", id),
      user
        ? supabase.from("user_books").select("book_id").eq("user_id", user.id).in("status", ["read", "currently_reading"])
        : Promise.resolve({ data: [] as { book_id: string }[] }),
    ])

    const sharedCountByBook = new Map<string, number>()
    for (const row of sharedRows ?? []) {
      sharedCountByBook.set(row.book_id, (sharedCountByBook.get(row.book_id) ?? 0) + 1)
    }

    const excludedBookIds = new Set((ownedBooks ?? []).map((r) => r.book_id))

    const candidateIds = Array.from(sharedCountByBook.keys()).filter((bookId) => !excludedBookIds.has(bookId))
    if (candidateIds.length > 0) {
      const { data: candidateBooks } = await supabase
        .from("books")
        .select("id, title, cover_url, avg_rating")
        .in("id", candidateIds)

      recommendations = (candidateBooks ?? [])
        .sort((a, b) => {
          const sharedDiff = (sharedCountByBook.get(b.id) ?? 0) - (sharedCountByBook.get(a.id) ?? 0)
          if (sharedDiff !== 0) return sharedDiff
          return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0)
        })
        .slice(0, 6)
    }
  }

  const authors = (book.book_authors ?? [])
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .filter((ba: any) => ba.role === "author")
    .map((ba: any) => ba.author)

  const translators = (book.book_authors ?? [])
    .filter((ba: any) => ba.role === "translator")
    .map((ba: any) => ba.author)

  return (
    <div className="max-w-3xl mx-auto space-y-10 sm:pb-0 pb-28">
      {/* Back navigation */}
      <BackButton />

      {/* Book header */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        {/* Cover */}
        <div className="shrink-0">
          <div className="w-36 sm:w-48 aspect-[2/3] relative rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }}>
            <BookCover src={book.cover_url} title={book.title} author={authors[0]?.name} className="w-full h-full" sizes="192px" />
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
                  <Link href={`/authors/${a.id}`} className="font-semibold hover:underline">{a.name}</Link>
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

          {/* Action buttons — desktop inline, mobile sticky bar */}
          {user && (
            <BookActionBar
              bookId={book.id}
              initialStatus={(userBook?.status as any) ?? null}
              initialFinishedAt={userBook?.finished_at ?? null}
              lists={userLists}
              initialListIds={bookInListIds}
            />
          )}

          {/* Optional reading progress — only when currently reading */}
          {userBook?.status === "currently_reading" && (
            <ReadingProgress
              bookId={book.id}
              pageCount={book.page_count ?? null}
              currentPage={userBook.current_page ?? null}
            />
          )}
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Résumé</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {book.description.replace(/<[^>]*>/g, "").trim()}
          </p>
        </div>
      )}

      {/* Rating section — community bar + user star rating */}
      {(book.rating_count > 0 || user) && (
        <RatingSection
          bookId={book.id}
          avgRating={book.rating_count > 0 ? Number(book.avg_rating) : 0}
          ratingCount={book.rating_count ?? 0}
          userRating={userRating}
          canRate={userBook?.status === "read"}
        />
      )}

      {/* Rating + review section — only shown once the user has read the book */}
      {(userBook?.status === "read" || !user || (reviews && reviews.length > 0)) && (
      <div>
        <h2 className="text-lg font-semibold mb-4">Critiques</h2>

        {user && userBook?.status === "read" ? (
          <ReviewFormSection
            bookId={book.id}
            initialScore={userRating}
            initialReview={userReview}
            username={user.id}
          />
        ) : user ? (
          <p className="text-sm text-[--muted-foreground]">
            Terminez ce livre pour laisser une critique.
          </p>
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
              <div key={r.id} className="rounded-2xl bg-[--card] p-5 space-y-3">
                <ReviewCard
                  review={{ ...r, profile: r.profile as any, score: ratingMap[r.user_id] ?? null }}
                  currentUserId={user?.id}
                />
                <CommentsSection
                  reviewId={r.id}
                  bookId={id}
                  initialComments={commentsByReview[r.id] ?? []}
                  currentUserId={user?.id}
                  currentUserProfile={currentUserProfile ?? undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Vous aimerez aussi</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {recommendations.map((rec) => (
              <Link key={rec.id} href={`/books/${rec.id}`} className="group">
                <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-[--secondary] mb-2">
                  <BookCover src={rec.cover_url} title={rec.title} className="w-full h-full" sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw" />
                </div>
                <p className="text-xs font-semibold line-clamp-2 group-hover:underline leading-tight">{rec.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

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
