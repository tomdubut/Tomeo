"use client"

import { useState } from "react"

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"

interface Props {
  /** Score on a 0–10 scale (0.5 steps). 0 = no rating. */
  score: number
  /** Star size class, e.g. "h-7 w-7". Defaults to "h-8 w-8". */
  size?: string
  disabled?: boolean
  /** Called with the new /10 score when the user clicks a star. */
  onChange?: (score: number) => void
  /** Unique prefix for SVG clipPath IDs (required when multiple pickers on same page). */
  idPrefix?: string
  showClear?: boolean
}

export default function StarRating({ score, size = "h-8 w-8", disabled = false, onChange, idPrefix = "star", showClear = false }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? score

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = star * 2
        const half = (star - 0.5) * 2
        const filled = display >= full ? "full" : display >= half ? "half" : "empty"

        return (
          <div key={star} className={`relative ${size} ${!disabled && onChange ? "cursor-pointer" : ""}`}>
            <svg viewBox="0 0 24 24" className={`absolute inset-0 ${size} text-[--border]`} fill="currentColor">
              <path d={STAR_PATH} />
            </svg>
            {filled === "half" && (
              <svg viewBox="0 0 24 24" className={`absolute inset-0 ${size} text-amber-400`} fill="currentColor">
                <defs>
                  <clipPath id={`${idPrefix}-half-${star}`}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <path d={STAR_PATH} clipPath={`url(#${idPrefix}-half-${star})`} />
              </svg>
            )}
            {filled === "full" && (
              <svg viewBox="0 0 24 24" className={`absolute inset-0 ${size} text-amber-400`} fill="currentColor">
                <path d={STAR_PATH} />
              </svg>
            )}
            {!disabled && onChange && (
              <>
                <div className="absolute left-0 top-0 h-full w-1/2" onMouseEnter={() => setHovered(half)} onClick={() => onChange(half)} />
                <div className="absolute right-0 top-0 h-full w-1/2" onMouseEnter={() => setHovered(full)} onClick={() => onChange(full)} />
              </>
            )}
          </div>
        )
      })}
      {score > 0 && (
        <span className="ml-2 text-sm font-semibold" style={{ color: "var(--primary)" }}>{score}/10</span>
      )}
      {showClear && score > 0 && onChange && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="ml-2 text-xs text-[--muted-foreground] hover:text-[--foreground] underline underline-offset-2"
        >
          Effacer
        </button>
      )}
    </div>
  )
}
