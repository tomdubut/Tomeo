import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function POST(req: NextRequest) {
  const { posA, posB } = await req.json()
  if (posA === posB) return NextResponse.json({ ok: true })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: rows } = await supabase
    .from("profile_favourite_books")
    .select("position, book_id")
    .eq("user_id", user.id)
    .in("position", [posA, posB])

  const bookA = rows?.find((r: any) => r.position === posA)?.book_id ?? null
  const bookB = rows?.find((r: any) => r.position === posB)?.book_id ?? null

  await supabase.from("profile_favourite_books").delete().eq("user_id", user.id).in("position", [posA, posB])

  const toInsert: any[] = []
  if (bookA) toInsert.push({ user_id: user.id, book_id: bookA, position: posB })
  if (bookB) toInsert.push({ user_id: user.id, book_id: bookB, position: posA })
  if (toInsert.length) await supabase.from("profile_favourite_books").insert(toInsert)

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single()
  if (profile?.username) revalidatePath(`/users/${profile.username}`)

  return NextResponse.json({ ok: true })
}
