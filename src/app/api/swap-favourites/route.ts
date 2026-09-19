import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserUsername } from "@/lib/supabase/queries"
import { revalidatePath } from "next/cache"

export async function POST(req: NextRequest) {
  const { posA, posB } = await req.json()

  const pA = Number(posA)
  const pB = Number(posB)
  if (!Number.isInteger(pA) || !Number.isInteger(pB) || pA < 1 || pA > 4 || pB < 1 || pB > 4) {
    return NextResponse.json({ error: "Invalid positions" }, { status: 400 })
  }
  if (pA === pB) return NextResponse.json({ ok: true })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: rows } = await supabase
    .from("profile_favourite_books")
    .select("position, book_id")
    .eq("user_id", user.id)
    .in("position", [pA, pB])

  const bookA = rows?.find((r: any) => r.position === pA)?.book_id ?? null
  const bookB = rows?.find((r: any) => r.position === pB)?.book_id ?? null

  if (bookA && bookB) {
    // Both slots filled: swap book_ids in-place — no delete, no data loss risk
    await supabase.from("profile_favourite_books")
      .update({ book_id: bookB })
      .eq("user_id", user.id).eq("position", pA)
    await supabase.from("profile_favourite_books")
      .update({ book_id: bookA })
      .eq("user_id", user.id).eq("position", pB)
  } else if (bookA) {
    // Move bookA to empty slot pB: update position only
    await supabase.from("profile_favourite_books")
      .update({ position: pB })
      .eq("user_id", user.id).eq("position", pA)
  } else if (bookB) {
    // Move bookB to empty slot pA: update position only
    await supabase.from("profile_favourite_books")
      .update({ position: pA })
      .eq("user_id", user.id).eq("position", pB)
  }

  const username = await getUserUsername(user.id)
  if (username) revalidatePath(`/users/${username}`)

  return NextResponse.json({ ok: true })
}
