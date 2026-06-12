"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

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

  revalidatePath(`/books/${bookId}`)
}

export async function deleteComment(commentId: string, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id)
  revalidatePath(`/books/${bookId}`)
}
