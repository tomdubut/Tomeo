import { createClient } from "@/lib/supabase/server"
import { REPORT_REASONS } from "@/lib/validation"

/** Saves a "wrong information" report on a book or manga. At most 10 reports per hour per user. */
export async function submitContentReport(
  target: { content_type: "book"; book_id: string } | { content_type: "manga"; manga_id: string },
  reason: string,
  note: string | null,
) {
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw new Error("Motif invalide")
  const cleanNote = note?.trim().slice(0, 1000) || null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since)
  if ((count ?? 0) >= 10) throw new Error("Trop de signalements")

  const { error } = await supabase.from("content_reports").insert({ ...target, user_id: user.id, reason, note: cleanNote })
  if (error) throw new Error(error.message)
}
