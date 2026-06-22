"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import { saveRatingOnly } from "@/app/(main)/books/actions"
import { toast } from "sonner"

interface Props {
  bookId: string
  avgRating: number
  ratingCount: number
  userRating: number | null
  canRate: boolean
}

function RatingSlider({
  score,
  disabled,
  onChange,
}: {
  score: number
  disabled: boolean
  onChange: (s: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [live, setLive] = useState<number | null>(null)

  const display = live ?? score
  const pct = display > 0 ? ((display - 1) / 9) * 100 : 0

  function scoreFromX(clientX: number) {
    if (!trackRef.current) return 0
    const { left, width } = trackRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - left) / width))
    // Map 0–1 to 1–10 in 0.5 steps
    const raw = 1 + ratio * 9
    return Math.round(raw * 2) / 2
  }

  const onMove = useCallback((clientX: number) => {
    if (disabled) return
    setLive(scoreFromX(clientX))
  }, [disabled])

  const onCommit = useCallback((clientX: number) => {
    if (disabled) return
    const s = scoreFromX(clientX)
    setLive(null)
    setDragging(false)
    onChange(s)
  }, [disabled, onChange])

  // Mouse
  function onMouseDown(e: React.MouseEvent) {
    if (disabled) return
    e.preventDefault()
    setDragging(true)
    setLive(scoreFromX(e.clientX))

    function onMouseMove(e: MouseEvent) { onMove(e.clientX) }
    function onMouseUp(e: MouseEvent) {
      onCommit(e.clientX)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  // Touch
  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return
    setDragging(true)
    setLive(scoreFromX(e.touches[0].clientX))

    function onTouchMove(e: TouchEvent) { onMove(e.touches[0].clientX) }
    function onTouchEnd(e: TouchEvent) {
      if (e.changedTouches[0]) onCommit(e.changedTouches[0].clientX)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd)
  }

  return (
    <div className={`space-y-3 ${disabled ? "opacity-40" : ""}`}>
      {/* Score label */}
      <div className="flex items-baseline gap-1.5">
        {display > 0 ? (
          <>
            <span className="text-2xl font-extrabold" style={{ color: "var(--primary)" }}>{display.toFixed(1)}</span>
            <span className="text-sm text-[--muted-foreground]">/10</span>
          </>
        ) : (
          <span className="text-sm text-[--muted-foreground]">—</span>
        )}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className={`relative h-10 flex items-center ${disabled ? "" : "cursor-grab"} ${dragging ? "cursor-grabbing" : ""}`}
      >
        {/* Rail */}
        <div className="absolute inset-x-0 h-2 rounded-full" style={{ background: "var(--secondary)" }}>
          {/* Fill */}
          {display > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct}%`,
                background: "var(--primary)",
                transition: dragging ? "none" : "width 0.15s ease",
              }}
            />
          )}
        </div>

        {/* Thumb */}
        {display > 0 && (
          <div
            className="absolute h-5 w-5 rounded-full border-2 -translate-x-1/2 shadow-md"
            style={{
              left: `${pct}%`,
              background: "var(--background)",
              borderColor: "var(--primary)",
              transition: dragging ? "none" : "left 0.15s ease",
            }}
          />
        )}

        {/* Tick marks */}
        <div className="absolute inset-x-0 top-full mt-1.5 flex justify-between px-0 pointer-events-none">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <span key={n} className="text-[10px] text-[--muted-foreground] w-0 flex justify-center">{n}</span>
          ))}
        </div>
      </div>
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
    <div className="rounded-2xl p-5 space-y-5" style={{ background: "var(--card)", boxShadow: "var(--shadow-sm)" }}>
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

      {/* User rating slider */}
      <div>
        <p className="text-xs text-[--muted-foreground] mb-3">
          {canRate ? "Votre note" : "Terminez ce livre pour noter"}
        </p>
        <div className={`pb-5 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
          <RatingSlider score={rating} disabled={!canRate} onChange={handleRate} />
        </div>
      </div>
    </div>
  )
}
