"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveQuickReview } from "@/app/(main)/books/actions"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import StarRating from "@/components/reviews/StarRating"

interface Props {
  /** Book to save to; or pass onPublish to save something else (a manga) */
  bookId?: string
  onPublish?: (score: number | null, body: string | null, isSpoiler: boolean, isPrivate: boolean) => Promise<void>
  /** "ce livre" / "ce manga" in the placeholder */
  itemLabel?: string
  hasRating: boolean
  hasReview: boolean
  existingScore: number | null
  onClose: () => void
}

// Same minimum as the database constraint on reviews
const MIN_REVIEW_LENGTH = 10

export default function PostReadModal({ bookId, onPublish, itemLabel = "ce livre", hasRating, hasReview, existingScore, onClose }: Props) {
  const [score, setScore] = useState<number>(existingScore ?? 0)
  const [body, setBody] = useState("")
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const heading =
    !hasRating && !hasReview
      ? "Envie de laisser une note ou un avis ?"
      : hasRating && !hasReview
      ? "Voulez-vous laisser un commentaire ?"
      : "Voulez-vous donner une note ?"

  const bodyLength = body.trim().length
  const bodyTooShort = bodyLength > 0 && bodyLength < MIN_REVIEW_LENGTH
  const canPublish = !bodyTooShort && ((!hasRating && score > 0) || (!hasReview && bodyLength >= MIN_REVIEW_LENGTH))

  function publish() {
    startTransition(async () => {
      try {
        const newScore = !hasRating && score > 0 ? score : null
        const newBody = !hasReview && bodyLength >= MIN_REVIEW_LENGTH ? body : null
        if (onPublish) await onPublish(newScore, newBody, isSpoiler, isPrivate)
        else if (bookId) await saveQuickReview(bookId, newScore, newBody, isSpoiler, isPrivate)
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!hasRating && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Votre note</p>
            <StarRating score={score} onChange={setScore} idPrefix="prm" showClear />
          </div>
        )}

        {!hasReview && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Commentaire <span className="text-muted-foreground font-normal">(optionnel)</span></p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder={`Partagez votre avis sur ${itemLabel}…`}
              className="flex w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
            {bodyTooShort && (
              <p className="text-xs text-muted-foreground">Encore {MIN_REVIEW_LENGTH - bodyLength} caractère{MIN_REVIEW_LENGTH - bodyLength > 1 ? "s" : ""} pour publier un commentaire.</p>
            )}
            {bodyLength >= 1 && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} className="rounded border-border" />
                  <span>Contient des spoilers</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-border" />
                  <span>Critique privée</span>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Passer
          </Button>
          <Button onClick={publish} disabled={!canPublish || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isPrivate ? "Enregistrer (privée)" : "Publier"}
          </Button>
        </div>
      </div>
    </div>
  )
}
