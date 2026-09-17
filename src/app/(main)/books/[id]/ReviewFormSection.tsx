"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
  const router = useRouter()

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
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)" }}>
      {/* Orange header band */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--card))", borderBottom: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)" }}>
        <p className="font-bold text-sm" style={{ color: "var(--primary)" }}>
          {review ? "Modifier votre critique" : "✍️ Écrire une critique"}
        </p>
        {review && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
            Annuler
          </Button>
        )}
      </div>
      {/* Form body */}
      <div className="p-5 bg-[--card]">
        <ReviewForm
          bookId={bookId}
          initialBody={review?.body}
          initialSpoiler={review?.is_spoiler}
          initialPrivate={review?.is_private}
          currentStatus={currentStatus}
          onSaved={() => router.refresh()}
        />
      </div>
    </div>
  )
}
