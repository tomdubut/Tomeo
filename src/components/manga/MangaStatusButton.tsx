"use client"

import { useState, useTransition } from "react"
import { setMangaStatus } from "@/app/(main)/manga/actions"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type ReadingStatus = "want_to_read" | "currently_reading" | "read"

const STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: "À lire",
  currently_reading: "En cours",
  read: "Lu",
}

interface Props {
  mangaId: string
  initialStatus: string | null
  initialVolumesRead: number
  totalVolumes: number | null
}

export default function MangaStatusButton({ mangaId, initialStatus }: Props) {
  const [status, setStatus] = useState<ReadingStatus | null>(initialStatus as ReadingStatus | null)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function choose(newStatus: ReadingStatus | null) {
    setOpen(false)
    setStatus(newStatus)
    startTransition(async () => {
      await setMangaStatus(mangaId, newStatus)
    })
  }

  return (
    <div className="relative w-fit">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
          status ? "text-white" : "text-white"
        )}
        style={{ background: status ? "var(--primary)" : "#555" }}
      >
        {isPending ? (
          <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
        ) : status ? (
          <Check className="h-4 w-4" />
        ) : null}
        {status ? STATUS_LABELS[status] : "Ajouter à ma liste"}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 min-w-[160px] rounded-xl overflow-hidden bg-[--card] shadow-lg border border-[--border]">
          {(["want_to_read", "currently_reading", "read"] as ReadingStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => choose(s)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[--secondary]",
                status === s && "text-[--primary]"
              )}
            >
              {STATUS_LABELS[s]}
              {status === s && <Check className="inline h-3.5 w-3.5 ml-1.5" />}
            </button>
          ))}
          {status && (
            <>
              <div className="h-px bg-[--border] mx-3" />
              <button
                onClick={() => choose(null)}
                className="w-full text-left px-4 py-2.5 text-sm text-[--muted-foreground] hover:bg-[--secondary] transition-colors"
              >
                Retirer de ma liste
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
