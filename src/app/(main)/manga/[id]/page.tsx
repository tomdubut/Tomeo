import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import BookCover from "@/components/books/BookCover"
import BackButton from "@/components/ui/BackButton"
import MangaStatusButton from "@/components/manga/MangaStatusButton"
import MangaRatingSection from "@/components/manga/MangaRatingSection"
import MangaReviewCard from "@/components/manga/MangaReviewCard"
import MangaReviewFormSection from "./MangaReviewFormSection"
import { Star, BookOpen, Building2 } from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("manga_series").select("title_fr").eq("id", id).single()
  return { title: data ? `${data.title_fr} — Tomesie` : "Manga — Tomesie" }
}

export default async function MangaDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: manga }, { data: { user } }] = await Promise.all([
    supabase
      .from("manga_series")
      .select("id, title_fr, publisher, cover_url, jp_volume_count, description, avg_rating, rating_count")
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!manga) notFound()

  let userStatus: string | null = null
  let userVolumesRead = 0
  let userRating: number | null = null
  let userReview: { id: string; body: string; is_spoiler: boolean; is_private: boolean } | null = null
  let userProfile: { username: string; display_name: string | null; avatar_url: string | null } | null = null

  if (user) {
    const [umRes, ratingRes, reviewRes, profileRes] = await Promise.all([
      supabase.from("user_manga").select("status, volumes_read").eq("user_id", user.id).eq("manga_id", id).single(),
      supabase.from("manga_ratings").select("score").eq("user_id", user.id).eq("manga_id", id).single(),
      supabase.from("manga_reviews").select("id, body, is_spoiler, is_private").eq("user_id", user.id).eq("manga_id", id).single(),
      supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).single(),
    ])
    userStatus = umRes.data?.status ?? null
    userVolumesRead = umRes.data?.volumes_read ?? 0
    userRating = ratingRes.data?.score ?? null
    userReview = reviewRes.data ?? null
    userProfile = profileRes.data ?? null
  }

  // Community reviews
  const { data: communityReviews } = await supabase
    .from("manga_reviews")
    .select("id, body, is_spoiler, created_at, updated_at, user_id, manga_id, profile:profiles(username, display_name, avatar_url)")
    .eq("manga_id", id)
    .eq("is_private", false)
    .neq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(20)

  // Fetch scores for community reviewers
  const reviewerIds = (communityReviews ?? []).map((r) => r.user_id)
  const ratingMap = new Map<string, number>()
  if (reviewerIds.length > 0) {
    const { data: scores } = await supabase
      .from("manga_ratings")
      .select("user_id, score")
      .eq("manga_id", id)
      .in("user_id", reviewerIds)
    for (const s of scores ?? []) ratingMap.set(s.user_id, s.score)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10 sm:pb-0 pb-28">
      <BackButton />

      {/* Main card */}
      <div className="rounded-2xl bg-[--card] p-5 sm:p-6" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-7">
          {/* Cover */}
          <div className="shrink-0 flex justify-center sm:justify-start">
            <div className="w-36 sm:w-44 aspect-[2/3] relative rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }}>
              <BookCover src={manga.cover_url} title={manga.title_fr} className="w-full h-full" sizes="176px" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{manga.title_fr}</h1>

            {/* Metadata row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[--muted-foreground]">
              {manga.avg_rating && manga.rating_count > 0 && (
                <span className="flex items-center gap-1 font-medium" style={{ color: "var(--foreground)" }}>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {Number(manga.avg_rating).toFixed(1)}
                  <span className="text-[--muted-foreground] font-normal">/ 10 ({manga.rating_count})</span>
                </span>
              )}
              {manga.jp_volume_count && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {manga.jp_volume_count} tome{manga.jp_volume_count > 1 ? "s" : ""}
                </span>
              )}
              {manga.publisher && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {manga.publisher}
                </span>
              )}
            </div>

            {/* Tag */}
            <div className="flex flex-wrap gap-2">
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
              >
                Manga
              </span>
            </div>

            {/* Status button */}
            {user ? (
              <MangaStatusButton
                mangaId={manga.id}
                initialStatus={userStatus}
                initialVolumesRead={userVolumesRead}
                totalVolumes={manga.jp_volume_count}
              />
            ) : (
              <a
                href="/login"
                className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white w-fit"
                style={{ background: "var(--primary)" }}
              >
                Connectez-vous pour suivre ce manga
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {manga.description && (
          <div className="mt-4 pt-4 border-t border-[--border]">
            <p className="text-sm text-[--muted-foreground] leading-relaxed">{manga.description}</p>
          </div>
        )}
      </div>

      {/* Rating section */}
      {(manga.rating_count > 0 || user) && (
        <MangaRatingSection
          mangaId={manga.id}
          avgRating={manga.rating_count > 0 ? Number(manga.avg_rating) : 0}
          ratingCount={manga.rating_count ?? 0}
          userRating={userRating}
          canRate={!!user}
        />
      )}

      {/* Reviews section */}
      {(user || (communityReviews && communityReviews.length > 0)) && (
        <div>
          <h2 className="text-lg font-extrabold mb-4 pl-3" style={{ borderLeft: "3px solid var(--primary)" }}>Critiques</h2>

          {user && userProfile ? (
            <MangaReviewFormSection
              mangaId={manga.id}
              initialReview={userReview}
              userId={user.id}
              userProfile={userProfile}
            />
          ) : (
            <p className="text-sm text-[--muted-foreground]">
              <a href="/login" className="underline underline-offset-4">Connectez-vous</a> pour laisser une critique.
            </p>
          )}

          {communityReviews && communityReviews.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-[--muted-foreground] uppercase tracking-wide mb-3">
                {communityReviews.length} critique{communityReviews.length > 1 ? "s" : ""} de lecteurs
              </p>
              <div className="space-y-4">
                {communityReviews.map((r) => (
                  <MangaReviewCard
                    key={r.id}
                    review={{
                      ...r,
                      profile: r.profile as unknown as { username: string; display_name: string | null; avatar_url: string | null },
                      score: ratingMap.get(r.user_id) ?? null,
                    }}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
