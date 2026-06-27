"use client"

import { useState, useTransition } from "react"
import { saveReview, setReadingStatus } from "@/app/(main)/books/actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  bookId: string
  initialScore?: number
  initialBody?: string
  initialSpoiler?: boolean
  initialPrivate?: boolean
  onSaved?: () => void
  currentStatus?: "want_to_read" | "currently_reading" | "read" | null
}

// score is /10 (1-10 step 0.5). Stars are /5 so starValue = score / 2.
// Each of 5 stars has a left half (X - 0.5 points) and right half (X points).
function scoreToStars(score: number) { return score / 2 }
function starsToScore(stars: number) { return stars * 2 }

function StarPicker({ score, onChange }: { score: number; onChange: (s: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? score  // in /10

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = starsToScore(star)       // e.g. star 3 → 6/10
        const half = starsToScore(star - 0.5) // e.g. star 3 → 5/10

        // How filled is this star based on display value
        const filled = display >= full ? "full" : display >= half ? "half" : "empty"

        return (
          <div key={star} className="relative h-8 w-8 cursor-pointer">
            {/* Empty star base */}
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-8 w-8 text-[--border]" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>

            {/* Half fill */}
            {filled === "half" && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-8 w-8 text-amber-400" fill="currentColor">
                <defs>
                  <clipPath id={`half-${star}`}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" clipPath={`url(#half-${star})`} />
              </svg>
            )}

            {/* Full fill */}
            {filled === "full" && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-8 w-8 text-amber-400" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}

            {/* Left half hover zone → half star */}
            <div
              className="absolute left-0 top-0 h-full w-1/2"
              onMouseEnter={() => setHovered(half)}
              onClick={() => onChange(half)}
            />
            {/* Right half hover zone → full star */}
            <div
              className="absolute right-0 top-0 h-full w-1/2"
              onMouseEnter={() => setHovered(full)}
              onClick={() => onChange(full)}
            />
          </div>
        )
      })}

      {score > 0 && (
        <span className="ml-2 text-sm font-bold text-amber-500">{score}/10</span>
      )}

      {score > 0 && (
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

export default function ReviewForm({
  bookId,
  initialScore,
  initialBody = "",
  initialSpoiler = false,
  initialPrivate = false,
  onSaved,
  currentStatus,
}: Props) {
  const [score, setScore] = useState<number>(initialScore ?? 0)
  const [body, setBody] = useState(initialBody)
  const [isSpoiler, setIsSpoiler] = useState(initialSpoiler)
  const [isPrivate, setIsPrivate] = useState(initialPrivate)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)
  const [markAsRead, setMarkAsRead] = useState(currentStatus !== "read")
  const [finishedAt, setFinishedAt] = useState(today)

  function submit() {
    if (score === 0) { setError("Veuillez donner une note."); return }
    if (body.trim().length < 10) { setError("La critique doit contenir au moins 10 caractères."); return }
    setError(null)

    startTransition(async () => {
      const fd = new FormData()
      fd.set("book_id", bookId)
      fd.set("body", body)
      fd.set("score", String(score))
      if (isSpoiler) fd.set("is_spoiler", "on")
      if (isPrivate) fd.set("is_private", "on")
      try {
        if (currentStatus !== "read" && markAsRead) {
          await setReadingStatus(bookId, "read", finishedAt)
        }
        await saveReview(fd)
        toast.success("Critique publiée")
        onSaved?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue.")
        toast.error("Impossible d'enregistrer la critique")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Note</p>
        <StarPicker score={score} onChange={setScore} />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Critique</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={10000}
          placeholder="Partagez votre avis sur ce livre…"
          className="flex w-full rounded-md border border-[--border] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] resize-y"
        />
        <p className="text-xs text-[--muted-foreground] mt-1 text-right">{body.length}/10 000</p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isSpoiler}
            onChange={(e) => setIsSpoiler(e.target.checked)}
            className="rounded border-[--border]"
          />
          <span>Contient des spoilers</span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="rounded border-[--border]"
          />
          <span>Critique privée</span>
        </label>
      </div>

      {currentStatus !== "read" && (
        <div className="space-y-2 pt-1 border-t border-[--border]">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={markAsRead}
              onChange={(e) => setMarkAsRead(e.target.checked)}
              className="rounded border-[--border]"
            />
            <span>Marquer ce livre comme <strong>Lu</strong></span>
          </label>
          {markAsRead && (
            <input
              type="date"
              value={finishedAt}
              max={today}
              onChange={(e) => setFinishedAt(e.target.value)}
              style={{ fontSize: "16px" }}
              className="w-full rounded-xl bg-[--secondary] px-4 py-2.5 text-sm font-medium focus:outline-none"
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-[--destructive]">{error}</p>}

      <Button onClick={submit} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isPrivate ? "Enregistrer (privée)" : "Publier la critique"}
      </Button>
    </div>
  )
}
