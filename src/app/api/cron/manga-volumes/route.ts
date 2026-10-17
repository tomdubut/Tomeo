import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { latestFrenchVolume } from "@/lib/bnf/latestVolume"

// Daily (vercel.json): checks the BATCH series checked longest ago, so every ongoing series is
// checked about once a month. Collected series go first.
const BATCH = 30
export const maxDuration = 60

export async function GET(request: Request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; anyone else is refused
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: candidates, error } = await admin
    .from("manga_series")
    .select("id, title_fr, bnf_series, bnf_author, fr_volume_count, jp_volume_count, volumes_checked_at")
    .not("bnf_series", "is", null)
    .not("bnf_author", "is", null)
    .order("volumes_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH * 4)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Finished series (French count reached the final Japanese count) never change
  const ongoing = (candidates ?? []).filter((m) => !(m.jp_volume_count !== null && (m.fr_volume_count ?? 0) >= m.jp_volume_count))
  const ids = ongoing.map((m) => m.id)
  const { data: collected } = ids.length
    ? await admin.from("user_manga_volumes").select("manga_id").in("manga_id", ids)
    : { data: [] }
  const collectedIds = new Set((collected ?? []).map((r) => r.manga_id))
  const batch = [...ongoing.filter((m) => collectedIds.has(m.id)), ...ongoing.filter((m) => !collectedIds.has(m.id))].slice(0, BATCH)

  const started = Date.now()
  const updated: { title: string; from: number | null; to: number }[] = []
  let checked = 0
  for (const m of batch) {
    if (Date.now() - started > 50_000) break // stay inside maxDuration; the rest waits for tomorrow
    let latest: number | null = null
    try {
      latest = await latestFrenchVolume(m.bnf_series!, m.bnf_author!)
    } catch (e) {
      console.error("[cron/manga-volumes]", m.title_fr, e)
      continue // BnF unavailable: not marked as checked, retried first next time
    }
    checked++
    const current = m.fr_volume_count ?? 0
    // Only ever increase, and never past the final Japanese count: a wrong match can't wreck a series
    const plausible = latest !== null && latest > current && (m.jp_volume_count === null || latest <= m.jp_volume_count)
    const changes: Record<string, unknown> = { volumes_checked_at: new Date().toISOString() }
    if (plausible) {
      changes.fr_volume_count = latest
      updated.push({ title: m.title_fr, from: m.fr_volume_count, to: latest! })
    }
    await admin.from("manga_series").update(changes).eq("id", m.id)
  }

  console.log("[cron/manga-volumes]", JSON.stringify({ checked, updated }))
  return NextResponse.json({ checked, updated })
}
