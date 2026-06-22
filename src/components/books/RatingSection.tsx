"use client"

import { useState, useTransition } from "react"
import { saveRatingOnly } from "@/app/(main)/books/actions"
import { toast } from "sonner"

interface Props {
  bookId: string
  avgRating: number
  ratingCount: number
  userRating: number | null
  canRate: boolean
}

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"

function TenStarPicker({ score, disabled, onChange }: { score: number; disabled: boolean; onChange: (s: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? score

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const filled = display >= n

        return (
          <div
            key={n}
            className={`relative h-6 w-6 ${disabled ? "opacity-40" : "cursor-pointer"}`}
            onMouseEnter={() => !disabled && setHovered(n)}
            onClick={() => !disabled && onChange(n)}
          >
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-6 w-6 text-[--border]" fill="currentColor">
              <path d={STAR_PATH} />
            </svg>
            {filled && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-6 w-6 text-amber-400" fill="currentColor">
                <path d={STAR_PATH} />
              </svg>
            )}
          </div>
        )
      })}
      {score > 0 && (
        <span className="ml-2 text-sm font-semibold" style={{ color: "var(--primary)" }}>
          {score}/10
        </span>
      )}
    </div>
  )
}

export default function RatingSection({ bookId, avgRating, ratingCount, userRating, canRate }: Props) {
  const [rating, setRating] = useState(userRating ?? 0)
  const [isPending, startTransition] = useTransition()

  function handleRate(score: number) {
    if (!canRate || isPending) return
    setRating(score)
    startTransition(async () => {
      try {
        await saveRatingOnly(bookId, score)
        toast.success("Note enregistrée")
      } catch {
        toast.error("Impossible d'enregistrer la note")
      }
    })
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card)", boxShadow: "var(--shadow-sm)" }}>
      {/* Community average */}
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

      {/* User rating */}
      <div>
        <p className="text-xs text-[--muted-foreground] mb-2">
          {canRate ? "Votre note" : "Terminez ce livre pour noter"}
        </p>
        <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
          <TenStarPicker score={rating} disabled={!canRate} onChange={handleRate} />
        </div>
      </div>
    </div>
  )
}
