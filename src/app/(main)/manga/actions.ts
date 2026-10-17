"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { assertUuid, intInRange } from "@/lib/validation"
import { submitContentReport } from "@/lib/reports"

function mangaPath(mangaId: string) {
  return `/manga/${mangaId}`
}

// ── Library status ────────────────────────────────────────────────────────────

export async function setMangaStatus(
  mangaId: string,
  status: "want_to_read" | "currently_reading" | "read" | null,
  finishedAt?: string | null // YYYY-MM-DD, only relevant for "read"
) {
  assertUuid(mangaId, "Manga")
  if (status !== null && !["want_to_read", "currently_reading", "read"].includes(status)) throw new Error("Statut invalide")
  const today = new Date().toISOString().slice(0, 10)
  if (finishedAt != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(finishedAt)) throw new Error("Format de date invalide.")
    if (finishedAt > today) throw new Error("La date ne peut pas être dans le futur.")
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (status === null) {
    await supabase.from("user_manga").delete().eq("user_id", user.id).eq("manga_id", mangaId)
  } else {
    // Same date rules as books: a series being read has no finish date, and a finish date
    // can't precede the start date (the automatic start date is the one dropped).
    let dates: { started_at?: string | null; finished_at?: string | null } = {}
    if (status === "currently_reading") {
      dates = { started_at: today, finished_at: null }
    } else if (status === "read") {
      const finished = finishedAt ?? today
      const { data: current } = await supabase
        .from("user_manga")
        .select("started_at")
        .eq("user_id", user.id)
        .eq("manga_id", mangaId)
        .maybeSingle()
      dates = { finished_at: finished, ...(current?.started_at && current.started_at > finished ? { started_at: null } : {}) }
    }
    // Upsert: volumes_read isn't sent, so an existing row keeps its progress (new rows start at 0)
    await supabase.from("user_manga").upsert(
      { user_id: user.id, manga_id: mangaId, status, ...dates },
      { onConflict: "user_id,manga_id" }
    )
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

/** "Le tome N est sorti ? Je l'ai": adds the volume after the known count as owned, and reports the
 *  outdated count once per user and series so the catalogue gets updated. */
export async function addNewVolume(mangaId: string, volume: number): Promise<{ error?: string }> {
  const saved = await setVolumeStatus(mangaId, volume, "owned")
  if (saved.error) return saved

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const { count } = await supabase
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("manga_id", mangaId)
    .eq("reason", "wrong_volume")
  if (!count) {
    try {
      await submitContentReport({ content_type: "manga", manga_id: mangaId }, "wrong_volume", `Nouveau tome ${volume} ajouté depuis une collection`)
    } catch {
      // the volume is saved; a missed report (e.g. rate limit) isn't worth an error
    }
  }
  return {}
}

/** Removes every owned/ordered volume of a series from the user's collection. */
export async function clearCollection(mangaId: string): Promise<{ error?: string }> {
  assertUuid(mangaId, "Manga")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non connecté" }

  const { error } = await supabase.from("user_manga_volumes").delete().eq("user_id", user.id).eq("manga_id", mangaId)
  if (error) return { error: "Impossible de vider la collection." }
  return {}
}

/** After marking a series read: optional rating and/or short review in one step. */
export async function saveMangaQuickReview(mangaId: string, score: number | null, body: string | null, isSpoiler = false, isPrivate = false) {
  assertUuid(mangaId, "Manga")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  if (score !== null) {
    if (!(score >= 1 && score <= 10)) throw new Error("Note invalide")
    const { error } = await supabase.from("manga_ratings").upsert(
      { user_id: user.id, manga_id: mangaId, score },
      { onConflict: "user_id,manga_id" }
    )
    if (error) throw new Error(error.message)
  }
  const text = body?.trim() ?? ""
  if (text) {
    if (text.length < 10 || text.length > 10000) throw new Error("La critique doit contenir entre 10 et 10 000 caractères.")
    const { error } = await supabase.from("manga_reviews").upsert(
      { user_id: user.id, manga_id: mangaId, body: text, is_spoiler: isSpoiler, is_private: isPrivate },
      { onConflict: "user_id,manga_id" }
    )
    if (error) throw new Error(error.message)
  }
  revalidatePath(mangaPath(mangaId))
}
