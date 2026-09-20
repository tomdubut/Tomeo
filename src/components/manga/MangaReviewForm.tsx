"use client"

import { useState, useTransition } from "react"
import { saveMangaReview } from "@/app/(main)/manga/actions"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  mangaId: string
  initialBody?: string
  initialSpoiler?: boolean
  initialPrivate?: boolean
  onSaved?: () => void
}

export default function MangaReviewForm({ mangaId, initialBody = "", initialSpoiler = false, initialPrivate = false, onSaved }: Props) {
  const [body, setBody] = useState(initialBody)
  const [isSpoiler, setIsSpoiler] = useState(initialSpoiler)
  const [isPrivate, setIsPrivate] = useState(initialPrivate)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (body.trim().length < 10) { setError("La critique doit contenir au moins 10 caractères."); return }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("manga_id", mangaId)
      fd.set("body", body)
      if (isSpoiler) fd.set("is_spoiler", "on")
      if (isPrivate) fd.set("is_private", "on")
      try {
        await saveMangaReview(fd)
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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={10000}
        placeholder="Partagez votre avis sur ce manga…"
        className="w-full rounded-xl bg-[--secondary] px-4 py-3 text-sm placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] resize-none border-0"
        style={{ fontSize: "16px" }}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {([["is_spoiler", "Spoilers", isSpoiler, () => setIsSpoiler(v => !v)], ["is_private", "Privée", isPrivate, () => setIsPrivate(v => !v)]] as const).map(([, label, val, toggle]) => (
            <label key={label} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <div
                onClick={() => (toggle as () => void)()}
                className="h-5 w-5 rounded flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: val ? "var(--primary)" : "var(--secondary)", border: `1.5px solid ${val ? "var(--primary)" : "var(--border)"}` }}
              >
                {val && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <span className="text-[--muted-foreground]">{label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-[--muted-foreground]">{body.length} / 10 000</p>
      </div>

      {error && <p className="text-sm text-[--destructive]">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={isPending}
          className="h-10 px-6 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          style={{ background: "var(--primary)" }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isPrivate ? "Enregistrer (privée)" : "Publier"}
        </button>
      </div>
    </div>
  )
}
