"use client"

import BookCover from "@/components/books/BookCover"
import { ReadingStatusBadge } from "@/components/ui/badge"

type ReadingStatus = "want_to_read" | "currently_reading" | "read"

interface MangaSeries {
  id: string
  title_fr: string
  author: string | null
  publisher: string | null
  cover_url: string | null
  volume_count: number | null
}

interface Props {
  manga: MangaSeries
  status?: ReadingStatus
}

export default function MangaCard({ manga, status }: Props) {
  return (
    <a href={`/manga/${manga.id}`} className="group block">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-secondary shadow-card">
        <BookCover
          src={manga.cover_url}
          title={manga.title_fr}
          className="w-full h-full group-hover:opacity-80 transition-opacity"
          sizes="160px"
        />
        {status && <ReadingStatusBadge status={status} className="absolute bottom-1.5 left-1.5" />}
      </div>
      <p className="mt-2 text-xs font-semibold leading-tight line-clamp-2 group-hover:underline">{manga.title_fr}</p>
      {manga.author && (
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{manga.author}</p>
      )}
    </a>
  )
}
