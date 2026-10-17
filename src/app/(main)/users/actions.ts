"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/validation"

export async function followUser(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id === targetUserId || !isUuid(targetUserId)) return

  const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId })
  if (error) return // already following, or the target doesn't exist

  // Notify the followed user once per follower: a follow/unfollow loop must not flood their notifications.
  // Admin client: the notifications table has no insert policy for users.
  const admin = createAdminClient()
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetUserId)
    .eq("actor_id", user.id)
    .eq("type", "new_follower")
  if (!count) {
    await admin.from("notifications").insert({
      user_id: targetUserId,
      actor_id: user.id,
      type: "new_follower",
    })
  }

  revalidatePath("/")
}

export async function unfollowUser(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId)

  revalidatePath("/")
}
