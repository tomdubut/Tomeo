"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export type FeedbackKind = "bug" | "idea" | "other"
const KINDS: readonly string[] = ["bug", "idea", "other"]

/** Whether the visitor can send feedback (the footer link also shows on public pages). */
export async function canSendFeedback(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}

/** Saves a "Donner mon avis" message. At most 5 per hour per user. */
export async function sendFeedback(input: {
  kind: string
  message: string
  page: string
  viewport: string
}): Promise<{ error?: string }> {
  if (!KINDS.includes(input.kind)) return { error: "Type invalide." }
  const message = String(input.message ?? "").trim()
  if (message.length < 3) return { error: "Votre message est trop court." }
  if (message.length > 2000) return { error: "Votre message est trop long (2000 caractères max)." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Connectez-vous pour envoyer votre avis." }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since)
  if ((count ?? 0) >= 5) return { error: "Merci ! Vous avez déjà envoyé plusieurs messages, réessayez dans une heure." }

  const userAgent = (await headers()).get("user-agent")?.slice(0, 400) ?? null
  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    kind: input.kind,
    message,
    // A path on this site ("/books/…"); anything else is dropped
    page: /^\/(?![/\\])/.test(String(input.page ?? "")) ? String(input.page).slice(0, 300) : null,
    user_agent: userAgent,
    viewport: /^\d{2,5}x\d{2,5}$/.test(input.viewport) ? input.viewport : null,
  })
  if (error) {
    console.error("[sendFeedback]", error.message)
    return { error: "Impossible d'envoyer votre message pour le moment." }
  }
  return {}
}
