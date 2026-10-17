import { notFound } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"

/**
 * Gate for /admin pages and actions. Admins are listed in public.admins, which only the server
 * can read. Anyone else gets a 404, so the admin area doesn't reveal that it exists.
 * Returns the service-role client: admin pages read data across all users.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const admin = createAdminClient()
  const { data } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()
  if (!data) notFound()
  return { admin, userId: user.id }
}

/** Same check without the 404, for showing an "Administration" link. */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("admins").select("user_id").eq("user_id", userId).maybeSingle()
  return !!data
}

/** Emails and last sign-ins (auth data, not in profiles), keyed by user id. Fine up to a few thousand users. */
export async function getAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const map = new Map<string, { email: string | null; lastSignIn: string | null }>()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data) break
    for (const u of data.users) map.set(u.id, { email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null })
    if (data.users.length < 1000) break
  }
  return map
}

/** "iPhone · Safari", "Windows · Chrome" from a user agent. Rough, for reading bug reports. */
export function describeDevice(ua: string | null): string | null {
  if (!ua) return null
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? "iPad" : "iPhone")
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux" : "Autre"
  const browser = /Edg\//.test(ua) ? "Edge"
    : /Firefox\//.test(ua) ? "Firefox"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) || /CriOS\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari" : "Navigateur inconnu"
  return `${os} · ${browser}`
}

export const REPORT_REASON_LABELS: Record<string, string> = {
  wrong_cover: "Couverture incorrecte",
  wrong_metadata: "Titre ou auteur incorrect",
  wrong_edition: "Mauvaise édition / doublon",
  wrong_description: "Description incorrecte",
  wrong_isbn: "ISBN incorrect",
  wrong_volume: "Nombre de tomes incorrect",
  other: "Autre",
}
