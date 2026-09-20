"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import MangaReviewForm from "@/components/manga/MangaReviewForm"
import MangaReviewCard from "@/components/manga/MangaReviewCard"
import { Button } from "@/components/ui/button"

interface Props {
  mangaId: string
  initialReview: { id: string; body: string; is_spoiler: boolean; is_private: boolean } | null
  userId: string
  userProfile: { username: string; display_name: string | null; avatar_url: string | null }
}

export default function MangaReviewFormSection({ mangaId, initialReview, userId, userProfile }: Props) {
  const [showForm, setShowForm] = useState(!initialReview)
  const [review, setReview] = useState(initialReview)
  const router = useRouter()

  if (review && !showForm) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-[--muted-foreground]">Votre critique</h3>
        <MangaReviewCard
          review={{
            ...review,
            manga_id: mangaId,
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            profile: userProfile,
            score: null,
          }}
          currentUserId={userId}
          onDeleted={() => { setReview(null); setShowForm(true) }}
        />
        <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>Modifier</Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)" }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--card))", borderBottom: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)" }}>
        <p className="font-bold text-sm" style={{ color: "var(--primary)" }}>
          {review ? "Modifier votre critique" : "✍️ Écrire une critique"}
        </p>
        {review && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Annuler</Button>
        )}
      </div>
      <div className="p-5 bg-[--card]">
        <MangaReviewForm
          mangaId={mangaId}
          initialBody={review?.body}
          initialSpoiler={review?.is_spoiler}
          initialPrivate={review?.is_private}
          onSaved={() => router.refresh()}
        />
      </div>
    </div>
  )
}
