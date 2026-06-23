"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { deleteReview } from "@/app/(main)/books/actions"
import UserAvatar from "@/components/ui/UserAvatar"
import { Button } from "@/components/ui/button"
import ReviewForm from "./ReviewForm"
import { AlertTriangle, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils/date"

interface ReviewCardProps {
  review: {
    id: string
    body: string
    is_spoiler: boolean
    created_at: string
    updated_at: string
    book_id: string
    user_id: string
    profile: {
      username: string
      display_name: string | null
      avatar_url: string | null
    }
    score?: number | null
  }
  currentUserId?: string
}

export default function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(!review.is_spoiler)
  const [editing, setEditing] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isOwn = currentUserId === review.user_id
  const displayName = review.profile.display_name ?? review.profile.username

  function handleDelete() {
    if (!confirm("Supprimer cette critique ?")) return
    startTransition(async () => {
      try {
        await deleteReview(review.book_id)
        setDeleted(true)
        toast.success("Critique supprimée")
      } catch {
        toast.error("Impossible de supprimer la critique")
      }
    })
  }

  if (deleted) return null
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Modifier la critique</span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
        </div>
        <ReviewForm
          bookId={review.book_id}
          initialScore={review.score ?? undefined}
          initialBody={review.body}
          initialSpoiler={review.is_spoiler}
          onSaved={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link href={`/users/${review.profile.username}`}>
            <UserAvatar profile={review.profile} className="h-8 w-8" />
          </Link>
          <div>
            <Link
              href={`/users/${review.profile.username}`}
              className="text-sm font-medium hover:underline"
            >
              {displayName}
            </Link>
            <p className="text-xs text-[--muted-foreground]">
              {formatDate(review.updated_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {review.score != null && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800">
              {review.score}/10
            </span>
          )}
          {isOwn && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[--destructive]"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Spoiler gate */}
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="flex items-center gap-2 text-sm text-[--muted-foreground] hover:text-[--foreground] transition-colors"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Cette critique contient des spoilers — cliquez pour révéler
        </button>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.body}</p>
      )}
    </div>
  )
}
