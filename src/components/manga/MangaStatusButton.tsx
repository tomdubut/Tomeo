"use client"

import { useState, useTransition } from "react"
import { saveMangaQuickReview, setMangaStatus } from "@/app/(main)/manga/actions"
import PostReadModal from "@/components/reviews/PostReadModal"
import { ChevronDown, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
  initialFinishedAt?: string | null
  hasRating?: boolean
  hasReview?: boolean
  existingScore?: number | null
}

// Read when the panel opens, not while rendering (Next can't prerender a component that reads the clock)
const todayISO = () => new Date().toISOString().slice(0, 10)

export default function MangaStatusButton({ mangaId, initialStatus, initialFinishedAt, hasRating = false, hasReview = false, existingScore = null }: Props) {
  const [status, setStatus] = useState<ReadingStatus | null>(initialStatus as ReadingStatus | null)
  const [open, setOpen] = useState(false)
  const [askDate, setAskDate] = useState(false)
  const [finishedAt, setFinishedAt] = useState(initialFinishedAt ?? "")
  const [isPending, startTransition] = useTransition()
  const [askReview, setAskReview] = useState(false)

  function commit(newStatus: ReadingStatus | null, date: string | null = null) {
    const previous = status
    setStatus(newStatus)
    startTransition(async () => {
      try {
        await setMangaStatus(mangaId, newStatus, date)
        if (newStatus === "read") {
          toast.success("Marqué comme lu ✓")
          // Same as books: offer to rate / review if not done yet
          if (!hasRating || !hasReview) setAskReview(true)
        }
      } catch {
        setStatus(previous)
        toast.error("Impossible de mettre à jour le statut.")
      }
    })
  }

  function choose(newStatus: ReadingStatus | null) {
    setOpen(false)
    // Same as books: "Lu" first asks when the series was finished
    if (newStatus === "read") {
      setFinishedAt((d) => d || todayISO())
      setAskDate(true)
      return
    }
    commit(newStatus)
  }

  return (
    <div>
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
        <div className="absolute left-0 top-full mt-1 z-10 min-w-[160px] rounded-xl overflow-hidden bg-card shadow-lg border border-border">
          {(["want_to_read", "currently_reading", "read"] as ReadingStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => choose(s)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary",
                status === s && "text-primary"
              )}
            >
              {STATUS_LABELS[s]}
              {status === s && <Check className="inline h-3.5 w-3.5 ml-1.5" />}
            </button>
          ))}
          {status && (
            <>
              <div className="h-px bg-border mx-3" />
              <button
                onClick={() => choose(null)}
                className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Retirer de ma liste
              </button>
            </>
          )}
        </div>
      )}

      </div>

      {askReview && (
        <PostReadModal
          itemLabel="ce manga"
          hasRating={hasRating}
          hasReview={hasReview}
          existingScore={existingScore}
          onPublish={(score, body, isSpoiler, isPrivate) => saveMangaQuickReview(mangaId, score, body, isSpoiler, isPrivate)}
          onClose={() => setAskReview(false)}
        />
      )}

      {askDate && (
        <div className="mt-3 w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-semibold">Date de fin de lecture</p>
          <input
            type="date"
            value={finishedAt}
            max={todayISO()}
            onChange={(e) => setFinishedAt(e.target.value)}
            className="w-full rounded-xl border border-input bg-secondary px-4 py-2.5 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!finishedAt || finishedAt > todayISO()}
              onClick={() => {
                setAskDate(false)
                commit("read", finishedAt)
              }}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAskDate(false)
                commit("read")
              }}
            >
              Passer
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => setAskDate(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
