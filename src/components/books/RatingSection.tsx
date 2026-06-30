"use client"

import { useState, useTransition } from "react"
import { saveRatingOnly, deleteRating } from "@/app/(main)/books/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import StatusPickerModal from "@/components/reviews/StatusPickerModal"
import StarRating from "@/components/reviews/StarRating"

interface Props {
  bookId: string
  avgRating: number
  ratingCount: number
  userRating: number | null
  canRate: boolean
  currentStatus?: "want_to_read" | "currently_reading" | "read" | null
}

export default function RatingSection({ bookId, avgRating, ratingCount, userRating, canRate, currentStatus }: Props) {
  const [rating, setRating] = useState(userRating ?? 0)
  const [isPending, startTransition] = useTransition()
  const [showStatusModal, setShowStatusModal] = useState(false)
  const router = useRouter()

  function handleRate(score: number) {
    if (!canRate || isPending) return
    setRating(score)
    startTransition(async () => {
      try {
        await saveRatingOnly(bookId, score)
        toast.success("Note enregistrée")
        if (currentStatus !== "read") {
          setShowStatusModal(true)
        } else {
          router.refresh()
        }
      } catch {
        toast.error("Impossible d'enregistrer la note")
      }
    })
  }

  function handleDeleteRating() {
    if (!canRate || isPending) return
    startTransition(async () => {
      try {
        await deleteRating(bookId)
        setRating(0)
        router.refresh()
        toast.success("Note supprimée")
      } catch {
        toast.error("Impossible de supprimer la note")
      }
    })
  }

  return (
    <>
      {showStatusModal && (
        <StatusPickerModal
          bookId={bookId}
          onClose={() => { setShowStatusModal(false); router.refresh() }}
        />
      )}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card)", boxShadow: "var(--shadow-sm)" }}>
        {avgRating > 0 && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{avgRating.toFixed(1)}</span>
                <span className="text-sm text-[--muted-foreground]">/10</span>
              </div>
              <span className="text-sm text-[--muted-foreground]">
                {ratingCount} note{ratingCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(avgRating / 10) * 100}%`, background: "rgba(245,158,11,0.75)" }}
              />
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-[--muted-foreground] mb-2">Votre note</p>
          <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
            <StarRating
              score={rating}
              size="h-7 w-7"
              disabled={!canRate}
              onChange={canRate ? handleRate : undefined}
              idPrefix="rs"
            />
          </div>
          {rating > 0 && canRate && (
            <button
              onClick={handleDeleteRating}
              disabled={isPending}
              className="mt-2 text-xs text-[--muted-foreground] hover:text-[--destructive] underline underline-offset-2 transition-colors"
            >
              Supprimer la note
            </button>
          )}
        </div>
      </div>
    </>
  )
}
