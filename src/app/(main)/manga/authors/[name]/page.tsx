import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import BookCover from "@/components/books/BookCover"
import BackButton from "@/components/ui/BackButton"
import { User } from "lucide-react"

interface Props {
  params: Promise<{ name: string }>
}

export async function generateMetadata({ params }: Props) {
  const { name } = await params
  const authorName = decodeURIComponent(name)
  return { title: `${authorName} — Tomesie` }
}

export default async function MangaAuthorPage({ params }: Props) {
  const { name } = await params
  const authorName = decodeURIComponent(name)
  const supabase = await createClient()

  const { data: series } = await supabase
    .from("manga_series")
    .select("id, title_fr, cover_url, jp_volume_count, publisher")
    .eq("author", authorName)
    .order("title_fr")

  if (!series || series.length === 0) notFound()

  return (
    <div className="max-w-3xl mx-auto space-y-8 sm:pb-0 pb-28">
      <BackButton />

      {/* Author header */}
      <div className="flex items-center gap-4">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
        >
          <User className="h-8 w-8" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{authorName}</h1>
          <p className="text-sm text-[--muted-foreground] mt-0.5">
            {series.length} série{series.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Manga grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {series.map((s) => (
          <Link key={s.id} href={`/manga/${s.id}`} className="group space-y-1.5">
            <div className="aspect-[2/3] relative rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
              <BookCover src={s.cover_url} title={s.title_fr} className="w-full h-full" sizes="150px" />
            </div>
            <p className="text-xs font-semibold leading-tight line-clamp-2 group-hover:underline">
              {s.title_fr}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
