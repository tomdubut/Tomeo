"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveQuickReview } from "@/app/(main)/books/actions"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Props {
  bookId: string
  hasRating: boolean
  hasReview: boolean
  existingScore: number | null
  onClose: () => void
}

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"

function StarPicker({ score, onChange }: { score: number; onChange: (s: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? score

  function starsToScore(stars: number) { return stars * 2 }

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = starsToScore(star)
        const half = starsToScore(star - 0.5)
        const filled = display >= full ? "full" : display >= half ? "half" : "empty"

        return (
          <div key={star} className="relative h-8 w-8 cursor-pointer">
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-8 w-8 text-[--border]" fill="currentColor">
              <path d={STAR_PATH} />
            </svg>
            {filled === "half" && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-8 w-8 text-amber-400" fill="currentColor">
                <defs>
                  <clipPath id={`pm-half-${star}`}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <path d={STAR_PATH} clipPath={`url(#pm-half-${star})`} />
              </svg>
            )}
            {filled === "full" && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-8 w-8 text-amber-400" fill="currentColor">
                <path d={STAR_PATH} />
              </svg>
            )}
            <div
              className="absolute left-0 top-0 h-full w-1/2"
              onMouseEnter={() => setHovered(half)}
              onClick={() => onChange(half)}
            />
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

export default function PostReadModal({ bookId, hasRating, hasReview, existingScore, onClose }: Props) {
  const [score, setScore] = useState<number>(existingScore ?? 0)
  const [body, setBody] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const heading =
    !hasRating && !hasReview
      ? "Envie de laisser une note ou un avis ?"
      : hasRating && !hasReview
      ? "Voulez-vous laisser un commentaire ?"
      : "Voulez-vous donner une note ?"

  const canPublish = (!hasRating && score > 0) || (!hasReview && body.trim().length >= 1)

  function publish() {
    startTransition(async () => {
      try {
        await saveQuickReview(
          bookId,
          !hasRating && score > 0 ? score : null,
          !hasReview && body.trim().length >= 1 ? body : null
        )
        toast.success("Publié !")
        router.refresh()
        onClose()
      } catch {
        toast.error("Impossible de publier")
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{heading}</h2>
          <button onClick={onClose} className="text-[--muted-foreground] hover:text-[--foreground]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!hasRating && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Votre note</p>
            <StarPicker score={score} onChange={setScore} />
          </div>
        )}

        {!hasReview && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Commentaire <span className="text-[--muted-foreground] font-normal">(optionnel)</span></p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Partagez votre avis sur ce livre…"
              className="flex w-full rounded-md border border-[--border] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] resize-y"
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Passer
          </Button>
          <Button onClick={publish} disabled={!canPublish || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publier"}
          </Button>
        </div>
      </div>
    </div>
  )
}
