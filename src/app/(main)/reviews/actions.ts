"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function addComment(reviewId: string, body: string, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non connecté")

  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 2000) return

  await supabase.from("comments").insert({
    user_id: user.id,
    review_id: reviewId,
    body: trimmed,
  })

  // Notify the review author (skip if commenting on own review)
  const { data: review } = await supabase.from("reviews").select("user_id, book_id").eq("id", reviewId).single()
  if (review && review.user_id !== user.id) {
    const admin = createAdminClient()
    await admin.from("notifications").insert({
      user_id: review.user_id,
      actor_id: user.id,
      type: "new_comment",
      review_id: reviewId,
      book_id: bookId || review.book_id,
    })
  }

  revalidatePath(`/books/${bookId}`)
}

export async function deleteComment(commentId: string, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id)
  revalidatePath(`/books/${bookId}`)
}
