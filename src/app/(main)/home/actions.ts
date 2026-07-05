"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateReadingGoal(goal: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("profiles")
    .update({ reading_goal: goal })
    .eq("id", user.id)

  revalidatePath("/home")
}
