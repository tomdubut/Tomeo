"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function followUser(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id === targetUserId) return

  await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId })

  // Notify the followed user (use admin client — notifications table has no insert RLS policy for users)
  const admin = createAdminClient()
  await admin.from("notifications").insert({
    user_id: targetUserId,
    actor_id: user.id,
    type: "new_follower",
  })

  revalidatePath("/")
}

export async function unfollowUser(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId)

  revalidatePath("/")
}
