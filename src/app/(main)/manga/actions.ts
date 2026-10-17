"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { assertUuid, intInRange } from "@/lib/validation"
import { submitContentReport } from "@/lib/reports"

function mangaPath(mangaId: string) {
  return `/manga/${mangaId}`
}

// ── Library status ────────────────────────────────────────────────────────────

export async function setMangaStatus(mangaId: string, status: string | null) {
  assertUuid(mangaId, "Manga")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (status === null) {
    await supabase.from("user_manga").delete().eq("user_id", user.id).eq("manga_id", mangaId)
  } else {
    // Try update first to preserve existing volumes_read; insert on first add
    const { count } = await supabase.from("user_manga")
      .update({ status })
      .eq("user_id", user.id)
      .eq("manga_id", mangaId)
    if (!count) {
      await supabase.from("user_manga").insert({ user_id: user.id, manga_id: mangaId, status, volumes_read: 0 })
    }
  }

  revalidatePath(mangaPath(mangaId))
  revalidatePath("/books")
}

export async function setMangaVolumesRead(mangaId: string, volumesRead: number) {
  assertUuid(mangaId, "Manga")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const volumes = intInRange(volumesRead, 0, 1000)
  if (volumes === null) throw new Error("Nombre de tomes invalide")

  await supabase.from("user_manga")
    .update({ volumes_read: volumes })
    .eq("user_id", user.id)
    .eq("manga_id", mangaId)

  revalidatePath(mangaPath(mangaId))
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function saveMangaRating(mangaId: string, score: number) {
  assertUuid(mangaId, "Manga")
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
  assertUuid(mangaId, "Manga")
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
  assertUuid(mangaId, "Manga")
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
  assertUuid(mangaId, "Manga")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase.from("manga_reviews").delete().eq("user_id", user.id).eq("manga_id", mangaId)
  revalidatePath(mangaPath(mangaId))
}

export async function submitMangaReport(mangaId: string, reason: string, note: string | null) {
  assertUuid(mangaId, "Manga")
  await submitContentReport({ content_type: "manga", manga_id: mangaId }, reason, note)
}

// ── Owned volumes ────────────────────────────────────────────────────────────

export type VolumeStatus = "owned" | "ordered"

/** Marks one volume owned, ordered, or (null) missing. */
export async function setVolumeStatus(mangaId: string, volume: number, status: VolumeStatus | null): Promise<{ error?: string }> {
  assertUuid(mangaId, "Manga")
  const n = intInRange(volume, 1, 1000)
  if (n === null) return { error: "Numéro de tome invalide" }
  if (status !== null && status !== "owned" && status !== "ordered") return { error: "Statut invalide" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non connecté" }

  const { error } = status === null
    ? await supabase.from("user_manga_volumes").delete().eq("user_id", user.id).eq("manga_id", mangaId).eq("volume", n)
    : await supabase.from("user_manga_volumes").upsert({ user_id: user.id, manga_id: mangaId, volume: n, status })
  if (error) return { error: "Impossible d'enregistrer ce tome." }
  return {}
}

/** Marks volumes 1 to `upTo` as owned (volumes after it are left as they are). */
export async function setVolumesOwnedUpTo(mangaId: string, upTo: number): Promise<{ error?: string }> {
  assertUuid(mangaId, "Manga")
  const n = intInRange(upTo, 1, 1000)
  if (n === null) return { error: "Numéro de tome invalide" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non connecté" }

  const rows = Array.from({ length: n }, (_, i) => ({ user_id: user.id, manga_id: mangaId, volume: i + 1, status: "owned" as const }))
  const { error } = await supabase.from("user_manga_volumes").upsert(rows)
  if (error) return { error: "Impossible d'enregistrer ces tomes." }
  return {}
}
