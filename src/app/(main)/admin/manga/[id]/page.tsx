import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import { isUuid } from "@/lib/validation"
import AdminShell from "@/components/admin/AdminShell"
import MangaEditForm from "@/components/admin/MangaEditForm"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminMangaEditPage({ params }: Props) {
  const { admin } = await requireAdmin()
  const { id } = await params
  if (!isUuid(id)) notFound()

  const { data: manga } = await admin
    .from("manga_series")
    .select("id, title_fr, author, publisher, description, cover_url, fr_volume_count, jp_volume_count, needs_review, anilist_id, source")
    .eq("id", id)
    .maybeSingle()
  if (!manga) notFound()

  return (
    <AdminShell active="catalogue">
      <div className="rounded-2xl bg-card p-5 shadow-card sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold">Modifier la série</h2>
            <p className="text-sm text-muted-foreground">
              {manga.anilist_id ? (
                <a href={`https://anilist.co/manga/${manga.anilist_id}`} target="_blank" rel="noreferrer" className="hover:underline">AniList #{manga.anilist_id}</a>
              ) : "Pas de fiche AniList"}
              {manga.source && ` · import : ${manga.source}`}
            </p>
          </div>
          <Link href={`/manga/${manga.id}`} className="text-sm font-semibold text-primary hover:underline">Voir la page →</Link>
        </div>
        <MangaEditForm manga={manga} />
      </div>
    </AdminShell>
  )
}
