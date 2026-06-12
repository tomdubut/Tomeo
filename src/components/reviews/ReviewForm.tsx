"use client"

import { useState, useTransition } from "react"
import { saveReview } from "@/app/(main)/books/actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  bookId: string
  initialScore?: number
  initialBody?: string
  initialSpoiler?: boolean
  onSaved?: () => void
}

export default function ReviewForm({
  bookId,
  initialScore,
  initialBody = "",
  initialSpoiler = false,
  onSaved,
}: Props) {
  const [score, setScore] = useState<number>(initialScore ?? 0)
  const [body, setBody] = useState(initialBody)
  const [isSpoiler, setIsSpoiler] = useState(initialSpoiler)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      try {
        await saveReview(fd)
        onSaved?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Score picker — 10 clickable dots */}
      <div>
        <p className="text-sm font-medium mb-2">Note <span className="text-[--muted-foreground] font-normal">/ 10</span></p>
        <div className="flex items-center gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={cn(
                "h-8 w-8 rounded-md text-sm font-medium border transition-colors",
                score >= n
                  ? "bg-amber-400 border-amber-400 text-white"
                  : "border-[--border] text-[--muted-foreground] hover:border-amber-300 hover:text-amber-500"
              )}
            >
              {n}
            </button>
          ))}
          {score > 0 && (
            <button
              type="button"
              onClick={() => setScore(0)}
              className="ml-2 text-xs text-[--muted-foreground] hover:text-[--foreground] underline underline-offset-2"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Review body */}
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
        <p className="text-xs text-[--muted-foreground] mt-1 text-right">
          {body.length}/10 000
        </p>
      </div>

      {/* Spoiler toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isSpoiler}
          onChange={(e) => setIsSpoiler(e.target.checked)}
          className="rounded border-[--border]"
        />
        <span>Contient des spoilers</span>
      </label>

      {error && (
        <p className="text-sm text-[--destructive]">{error}</p>
      )}

      <Button onClick={submit} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publier la critique"}
      </Button>
    </div>
  )
}
