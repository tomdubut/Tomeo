"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/validation"

export async function addComment(reviewId: string, body: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non connecté")

  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 2000) return { error: "Le commentaire doit faire entre 1 et 2000 caractères." }

  // Through the user's client: a private review (or a made-up id) isn't found, so it can't be commented on
  const { data: review } = await supabase.from("reviews").select("user_id, book_id").eq("id", reviewId).single()
  if (!review) return { error: "Cette critique n'est plus disponible." }

  // At most 10 comments per 10 minutes per user (each one notifies the review author)
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count: recent } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since)
  if ((recent ?? 0) >= 10) return { error: "Trop de commentaires en peu de temps. Réessayez dans quelques minutes." }

  const { error } = await supabase.from("comments").insert({
    user_id: user.id,
    review_id: reviewId,
    body: trimmed,
  })
  if (error) return { error: "Impossible de publier le commentaire." }

  // Notify the review author (skip if commenting on own review)
  if (review.user_id !== user.id) {
    const admin = createAdminClient()
    await admin.from("notifications").insert({
      user_id: review.user_id,
      actor_id: user.id,
      type: "new_comment",
      review_id: reviewId,
      book_id: review.book_id,
    })
  }

  revalidatePath(`/books/${review.book_id}`)
  return {}
}

export async function deleteComment(commentId: string, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id)
  if (isUuid(bookId)) revalidatePath(`/books/${bookId}`)
}
