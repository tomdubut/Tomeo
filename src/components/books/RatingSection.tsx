"use client"

import { useState, useTransition } from "react"
import { saveRatingOnly } from "@/app/(main)/books/actions"
import { toast } from "sonner"

interface Props {
  bookId: string
  avgRating: number
  ratingCount: number
  userRating: number | null
  canRate: boolean // true if status === "read"
}

function StarPicker({
  score,
  disabled,
  onChange,
}: {
  score: number
  disabled: boolean
  onChange: (s: number) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? score

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const full = star * 2
        const half = (star - 0.5) * 2
        const filled = display >= full ? "full" : display >= half ? "half" : "empty"

        return (
          <div
            key={star}
            className={`relative h-7 w-7 ${disabled ? "opacity-40" : "cursor-pointer"}`}
          >
            {/* Empty base */}
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-7 w-7 text-[--border]" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {filled === "half" && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-7 w-7 text-amber-400" fill="currentColor">
                <defs><clipPath id={`rs-half-${star}`}><rect x="0" y="0" width="12" height="24" /></clipPath></defs>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" clipPath={`url(#rs-half-${star})`} />
              </svg>
            )}
            {filled === "full" && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-7 w-7 text-amber-400" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {!disabled && (
              <>
                <div className="absolute left-0 top-0 h-full w-1/2" onMouseEnter={() => setHovered(half)} onClick={() => onChange(half)} />
                <div className="absolute right-0 top-0 h-full w-1/2" onMouseEnter={() => setHovered(full)} onClick={() => onChange(full)} />
              </>
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
        {/* Progress bar */}
        <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(avgRating / 10) * 100}%`,
              background: "rgba(245,158,11,0.75)",
            }}
          />
        </div>
      </div>

      {/* User rating */}
      <div className="pt-1 border-t border-[--border]">
        <p className="text-xs text-[--muted-foreground] mb-2">
          {canRate ? "Votre note" : "Terminez ce livre pour noter"}
        </p>
        <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
          <StarPicker score={rating} disabled={!canRate} onChange={handleRate} />
        </div>
      </div>
    </div>
  )
}
