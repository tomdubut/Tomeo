"use client"

import { useState } from "react"
import ReviewForm from "@/components/reviews/ReviewForm"
import ReviewCard from "@/components/reviews/ReviewCard"
import { Button } from "@/components/ui/button"

interface Props {
  bookId: string
  initialReview: { id: string; body: string; is_spoiler: boolean; is_private: boolean } | null
  username: string
  currentStatus: "want_to_read" | "currently_reading" | "read" | null
}

export default function ReviewFormSection({ bookId, initialReview, username, currentStatus }: Props) {
  const [showForm, setShowForm] = useState(!initialReview)
  const [review, setReview] = useState(initialReview)

  if (review && !showForm) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-[--muted-foreground]">Votre critique</h3>
        <ReviewCard
          review={{
            ...review,
            book_id: bookId,
            user_id: username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            profile: { username: "", display_name: "Vous", avatar_url: null },
            score: null,
          }}
          currentUserId={username}
          onDeleted={() => { setReview(null); setShowForm(true) }}
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
        initialBody={review?.body}
        initialSpoiler={review?.is_spoiler}
        initialPrivate={review?.is_private}
        currentStatus={currentStatus}
        onSaved={() => {
          window.location.reload()
        }}
      />
    </div>
  )
}
