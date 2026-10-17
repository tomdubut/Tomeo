"use server"

import { revalidatePath, updateTag } from "next/cache"
import { requireAdmin } from "@/lib/admin"
import { isUuid } from "@/lib/validation"

const FEEDBACK_STATUSES = ["new", "planned", "done", "ignored"]
const REPORT_STATUSES = ["new", "fixed", "ignored"]

export async function setFeedbackStatus(id: string, status: string) {
  const { admin } = await requireAdmin()
  if (!isUuid(id) || !FEEDBACK_STATUSES.includes(status)) return { error: "Requête invalide." }
  const { error } = await admin.from("feedback").update({ status }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin", "layout")
  return {}
}

export async function setReportStatus(id: string, status: string) {
  const { admin } = await requireAdmin()
  if (!isUuid(id) || !REPORT_STATUSES.includes(status)) return { error: "Requête invalide." }
  const { error } = await admin.from("content_reports").update({ status }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin", "layout")
  return {}
}

// ---------------------------------------------------------------------------
// Catalogue editing
// ---------------------------------------------------------------------------

function cleanText(value: unknown, max: number): string | null {
  const s = String(value ?? "").trim()
  return s ? s.slice(0, max) : null
}

/** An https image URL, or null to remove the cover. Throws on anything else. */
function cleanCoverUrl(value: unknown): string | null {
  const s = String(value ?? "").trim()
  if (!s) return null
  let url: URL
  try { url = new URL(s) } catch { throw new Error("Adresse de couverture invalide.") }
  if (url.protocol !== "https:" || s.length > 1000) throw new Error("La couverture doit être une adresse https.")
  return s
}

function cleanCount(value: unknown): number | null {
  const s = String(value ?? "").trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isInteger(n) || n < 0 || n > 1000) throw new Error("Nombre de tomes invalide (0 à 1000).")
  return n
}

export async function updateBook(
  id: string,
  input: { title: string; subtitle: string; description: string; cover_url: string; genres: string[] }
): Promise<{ error?: string }> {
  const { admin } = await requireAdmin()
  if (!isUuid(id)) return { error: "Livre invalide." }
  try {
    const title = cleanText(input.title, 300)
    if (!title) return { error: "Le titre est obligatoire." }
    const patch = {
      title,
      subtitle: cleanText(input.subtitle, 300),
      description: cleanText(input.description, 10000),
      cover_url: cleanCoverUrl(input.cover_url),
    }
    const { error } = await admin.from("books").update(patch).eq("id", id)
    if (error) return { error: error.message }

    // Genres: replace with the chosen ones (unknown slugs are ignored)
    const slugs = [...new Set((input.genres ?? []).map(String))].slice(0, 12)
    const { data: genreRows } = slugs.length
      ? await admin.from("genres").select("id").in("slug", slugs)
      : { data: [] as { id: number }[] }
    await admin.from("book_genres").delete().eq("book_id", id)
    if (genreRows?.length) {
      const { error: genreError } = await admin.from("book_genres").insert(genreRows.map((g) => ({ book_id: id, genre_id: g.id })))
      if (genreError) return { error: genreError.message }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" }
  }
  updateTag("books")
  updateTag(`book-${id}`)
  updateTag("genres")
  revalidatePath(`/books/${id}`)
  revalidatePath("/admin", "layout")
  return {}
}

export async function updateManga(
  id: string,
  input: {
    title_fr: string; author: string; publisher: string; description: string; cover_url: string
    fr_volume_count: string; jp_volume_count: string; needs_review: boolean
  }
): Promise<{ error?: string }> {
  const { admin } = await requireAdmin()
  if (!isUuid(id)) return { error: "Manga invalide." }
  try {
    const title_fr = cleanText(input.title_fr, 300)
    if (!title_fr) return { error: "Le titre est obligatoire." }
    const fr = cleanCount(input.fr_volume_count)
    const jp = cleanCount(input.jp_volume_count)
    if (fr !== null && jp !== null && fr > jp) return { error: "La France ne peut pas avoir plus de tomes que le Japon." }
    const { error } = await admin
      .from("manga_series")
      .update({
        title_fr,
        author: cleanText(input.author, 200),
        publisher: cleanText(input.publisher, 200),
        description: cleanText(input.description, 10000),
        cover_url: cleanCoverUrl(input.cover_url),
        fr_volume_count: fr,
        jp_volume_count: jp,
        needs_review: !!input.needs_review,
      })
      .eq("id", id)
    if (error) return { error: error.message }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" }
  }
  revalidatePath(`/manga/${id}`)
  revalidatePath("/admin", "layout")
  return {}
}

/** "Valider": the series is fine as it is (removes the import's "to check" flag). */
export async function approveManga(id: string): Promise<{ error?: string }> {
  const { admin } = await requireAdmin()
  if (!isUuid(id)) return { error: "Manga invalide." }
  const { error } = await admin.from("manga_series").update({ needs_review: false }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin", "layout")
  return {}
}
