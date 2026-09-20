"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

function mangaPath(mangaId: string) {
  return `/manga/${mangaId}`
}

// ── Library status ────────────────────────────────────────────────────────────

export async function setMangaStatus(mangaId: string, status: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (status === null) {
    await supabase.from("user_manga").delete().eq("user_id", user.id).eq("manga_id", mangaId)
  } else {
    await supabase.from("user_manga").upsert(
      { user_id: user.id, manga_id: mangaId, status, volumes_read: 0 },
      { onConflict: "user_id,manga_id" }
    )
  }

  revalidatePath(mangaPath(mangaId))
  revalidatePath("/books")
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function saveMangaRating(mangaId: string, score: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase.from("manga_ratings").upsert(
    { user_id: user.id, manga_id: mangaId, score },
    { onConflict: "user_id,manga_id" }
  )
  if (error) throw new Error(error.message)

  revalidatePath(mangaPath(mangaId))
}

export async function deleteMangaRating(mangaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("manga_ratings").delete().eq("user_id", user.id).eq("manga_id", mangaId)
  revalidatePath(mangaPath(mangaId))
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function saveMangaReview(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const mangaId = formData.get("manga_id") as string
  const body = (formData.get("body") as string)?.trim()
  const isSpoiler = formData.get("is_spoiler") === "on"
  const isPrivate = formData.get("is_private") === "on"
  const score = formData.get("score") ? Number(formData.get("score")) : null

  if (!body || body.length < 10) throw new Error("La critique doit contenir au moins 10 caractères.")

  if (score !== null) {
    await supabase.from("manga_ratings").upsert(
      { user_id: user.id, manga_id: mangaId, score },
      { onConflict: "user_id,manga_id" }
    )
  }

  const { error } = await supabase.from("manga_reviews").upsert(
    { user_id: user.id, manga_id: mangaId, body, is_spoiler: isSpoiler, is_private: isPrivate },
    { onConflict: "user_id,manga_id" }
  )
  if (error) throw new Error(error.message)

  revalidatePath(mangaPath(mangaId))
}

export async function deleteMangaReview(mangaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("manga_reviews").delete().eq("user_id", user.id).eq("manga_id", mangaId)
  revalidatePath(mangaPath(mangaId))
}
