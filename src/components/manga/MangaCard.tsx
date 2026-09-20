"use client"

import { useState, useTransition } from "react"
import BookCover from "@/components/books/BookCover"
import { setMangaStatus } from "@/app/(main)/manga/actions"
import { cn } from "@/lib/utils"

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

export default function MangaCard({ manga, status: initialStatus }: Props) {
  const [status, setStatus] = useState<ReadingStatus | undefined>(initialStatus)
  const [showMenu, setShowMenu] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleStatusChange(newStatus: ReadingStatus | null) {
    setShowMenu(false)
    const optimistic = newStatus ?? undefined
    setStatus(optimistic)
    startTransition(async () => {
      await setMangaStatus(manga.id, newStatus)
    })
  }

  return (
    <div className="group relative">
      <div
        className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary] relative cursor-pointer"
        style={{ boxShadow: "var(--shadow-sm)" }}
        onClick={() => setShowMenu((v) => !v)}
      >
        <BookCover
          src={manga.cover_url}
          title={manga.title_fr}
          className="w-full h-full group-hover:opacity-80 transition-opacity"
          sizes="160px"
        />
        {isPending && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        )}
        {status && !isPending && (
          <span
            className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none"
            style={{ background: "#e8650a", color: "#fff" }}
          >
            {STATUS_LABELS[status]}
          </span>
        )}

        {/* Status menu */}
        {showMenu && (
          <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-1.5 p-2">
            {(["want_to_read", "currently_reading", "read"] as ReadingStatus[]).map((s) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); handleStatusChange(s) }}
                className={cn(
                  "w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-white transition-colors",
                  status === s ? "bg-[--primary]" : "bg-white/20 hover:bg-white/30"
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            {status && (
              <button
                onClick={(e) => { e.stopPropagation(); handleStatusChange(null) }}
                className="w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                Retirer
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs font-semibold leading-tight line-clamp-2">{manga.title_fr}</p>
      {manga.publisher && (
        <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{manga.publisher}</p>
      )}
    </div>
  )
}
