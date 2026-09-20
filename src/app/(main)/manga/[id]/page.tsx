import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import BookCover from "@/components/books/BookCover"
import BackButton from "@/components/ui/BackButton"
import MangaStatusButton from "@/components/manga/MangaStatusButton"
import { BookOpen } from "lucide-react"

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
      .select("id, title_fr, publisher, cover_url, jp_volume_count, description, avg_rating, rating_count, needs_review")
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!manga) notFound()

  let userStatus: string | null = null
  let userVolumesRead: number = 0
  if (user) {
    const { data: um } = await supabase
      .from("user_manga")
      .select("status, volumes_read")
      .eq("user_id", user.id)
      .eq("manga_id", id)
      .single()
    userStatus = um?.status ?? null
    userVolumesRead = um?.volumes_read ?? 0
  }

  return (
    <div className="space-y-6">
      <BackButton />

      <div className="flex gap-5">
        <div className="w-28 shrink-0 sm:w-36">
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[--secondary]" style={{ boxShadow: "var(--shadow-sm)" }}>
            <BookCover
              src={manga.cover_url}
              title={manga.title_fr}
              className="w-full h-full"
              sizes="144px"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <h1 className="text-xl font-bold leading-tight">{manga.title_fr}</h1>
            {manga.publisher && (
              <p className="text-sm text-[--muted-foreground] mt-0.5">{manga.publisher}</p>
            )}
          </div>

          {manga.jp_volume_count && (
            <div className="flex items-center gap-1.5 text-sm text-[--muted-foreground]">
              <BookOpen className="h-4 w-4" />
              <span>{manga.jp_volume_count} tome{manga.jp_volume_count > 1 ? "s" : ""}</span>
            </div>
          )}

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

      {manga.description && (
        <div className="rounded-2xl bg-[--card] p-5 space-y-2">
          <h2 className="text-sm font-semibold">Synopsis</h2>
          <p className="text-sm text-[--muted-foreground] leading-relaxed">{manga.description}</p>
        </div>
      )}
    </div>
  )
}
