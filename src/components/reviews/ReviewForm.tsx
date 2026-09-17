"use client"

import { useState, useTransition } from "react"
import { saveReview, setReadingStatus } from "@/app/(main)/books/actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import StatusPickerModal from "@/components/reviews/StatusPickerModal"

interface Props {
  bookId: string
  initialBody?: string
  initialSpoiler?: boolean
  initialPrivate?: boolean
  onSaved?: () => void
  currentStatus?: "want_to_read" | "currently_reading" | "read" | null
}

export default function ReviewForm({
  bookId,
  initialBody = "",
  initialSpoiler = false,
  initialPrivate = false,
  onSaved,
  currentStatus,
}: Props) {
  const [body, setBody] = useState(initialBody)
  const [isSpoiler, setIsSpoiler] = useState(initialSpoiler)
  const [isPrivate, setIsPrivate] = useState(initialPrivate)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showStatusModal, setShowStatusModal] = useState(false)

  function submit() {
    if (body.trim().length < 10) { setError("La critique doit contenir au moins 10 caractères."); return }
    setError(null)

    startTransition(async () => {
      const fd = new FormData()
      fd.set("book_id", bookId)
      fd.set("body", body)
      if (isSpoiler) fd.set("is_spoiler", "on")
      if (isPrivate) fd.set("is_private", "on")
      try {
        await saveReview(fd)
        toast.success("Critique publiée")
        if (currentStatus !== "read") {
          setShowStatusModal(true)
        } else {
          onSaved?.()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue.")
        toast.error("Impossible d'enregistrer la critique")
      }
    })
  }

  return (
    <>
      {showStatusModal && (
        <StatusPickerModal
          bookId={bookId}
          onClose={() => { setShowStatusModal(false); onSaved?.() }}
        />
      )}
      <div className="space-y-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={10000}
          placeholder="Partagez votre avis sur ce livre…"
          className="w-full rounded-xl bg-[--secondary] px-4 py-3 text-sm placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] resize-none border-0"
          style={{ fontSize: "16px" }}
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <div
                onClick={() => setIsSpoiler((v) => !v)}
                className="h-5 w-5 rounded flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: isSpoiler ? "var(--primary)" : "var(--secondary)", border: `1.5px solid ${isSpoiler ? "var(--primary)" : "var(--border)"}` }}
              >
                {isSpoiler && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <span className="text-[--muted-foreground]">Spoilers</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <div
                onClick={() => setIsPrivate((v) => !v)}
                className="h-5 w-5 rounded flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: isPrivate ? "var(--primary)" : "var(--secondary)", border: `1.5px solid ${isPrivate ? "var(--primary)" : "var(--border)"}` }}
              >
                {isPrivate && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <span className="text-[--muted-foreground]">Privée</span>
            </label>
          </div>

          <p className="text-xs text-[--muted-foreground]">{body.length} / 10 000</p>
        </div>

        {error && <p className="text-sm text-[--destructive]">{error}</p>}

        <button
          onClick={submit}
          disabled={isPending}
          className="w-full h-12 rounded-xl text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: "var(--primary)" }}
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : isPrivate ? "Enregistrer (privée)" : "Publier la critique"}
        </button>
      </div>
    </>
  )
}
