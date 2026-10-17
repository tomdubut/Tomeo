"use server"

import { createClient } from "@/lib/supabase/server"
import { intInRange } from "@/lib/validation"
import { revalidatePath } from "next/cache"

export async function updateReadingGoal(goal: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  if (goal !== null && intInRange(goal, 1, 1000) === null) return

  await supabase
    .from("profiles")
    .update({ reading_goal: goal })
    .eq("id", user.id)

  revalidatePath("/home")
}
