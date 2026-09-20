"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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

  revalidatePath("/books")
}
