"use client"

import BookCover from "@/components/books/BookCover"

type ReadingStatus = "want_to_read" | "currently_reading" | "read"

const STATUS_LABELS: Record<ReadingStatus, string> = {
  read: "Lu",
  currently_reading: "En cours",
  want_to_read: "À lire",
}

interface MangaSeries {
  id: string
  title_fr: string
  publisher: string | null
  cover_url: string | null
  jp_volume_count: number | null
}

interface Props {
  manga: MangaSeries
  status?: ReadingStatus
}

export default function MangaCard({ manga, status }: Props) {
  return (
    <a href={`/manga/${manga.id}`} className="group block">
      <div
        className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary] relative"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <BookCover
          src={manga.cover_url}
          title={manga.title_fr}
          className="w-full h-full group-hover:opacity-80 transition-opacity"
          sizes="160px"
        />
        {status && (
          <span
            className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none"
            style={{ background: "#e8650a", color: "#fff" }}
          >
            {STATUS_LABELS[status]}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs font-semibold leading-tight line-clamp-2 group-hover:underline">{manga.title_fr}</p>
      {manga.publisher && (
        <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{manga.publisher}</p>
      )}
    </a>
  )
}
