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

        {error && <p className="text-sm text-[--destructive]">{error}</p>}

        <Button onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isPrivate ? "Enregistrer (privée)" : "Publier la critique"}
        </Button>
      </div>
    </>
  )
}
