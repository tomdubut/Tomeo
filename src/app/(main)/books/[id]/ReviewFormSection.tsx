"use client"

import { useState } from "react"
import ReviewForm from "@/components/reviews/ReviewForm"
import ReviewCard from "@/components/reviews/ReviewCard"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"

interface Props {
  bookId: string
  initialScore: number | null
  initialReview: { id: string; body: string; is_spoiler: boolean; is_private: boolean } | null
  username: string
}

export default function ReviewFormSection({ bookId, initialScore, initialReview, username }: Props) {
  const [showForm, setShowForm] = useState(!initialReview)
  const [review, setReview] = useState(initialReview)
  const [score, setScore] = useState(initialScore)

  if (review && !showForm) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[--muted-foreground]">Votre critique</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Modifier
          </Button>
        </div>
        <ReviewCard
          review={{
            ...review,
            book_id: bookId,
            user_id: username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            profile: { username: "", display_name: "Vous", avatar_url: null },
            score,
          }}
          currentUserId={username}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[--border] bg-[--card] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {review ? "Modifier votre critique" : "Écrire une critique"}
        </h3>
        {review && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
            Annuler
          </Button>
        )}
      </div>
      <ReviewForm
        bookId={bookId}
        initialScore={score ?? undefined}
        initialBody={review?.body}
        initialSpoiler={review?.is_spoiler}
        initialPrivate={review?.is_private}
        onSaved={() => {
          // Refresh the page to get updated review from server
          window.location.reload()
        }}
      />
    </div>
  )
}
