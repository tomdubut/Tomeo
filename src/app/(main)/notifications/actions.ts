"use server"

import { createClient } from "@/lib/supabase/server"

export type Notification = {
  id: string
  type: "new_follower" | "new_comment"
  read_at: string | null
  created_at: string
  review_id: string | null
  book_id: string | null
  actor: { username: string; display_name: string | null; avatar_url: string | null } | null
}

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("notifications")
    .select("id, type, read_at, created_at, review_id, book_id, actor:profiles!actor_id(username, display_name, avatar_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  return (data ?? []) as unknown as Notification[]
}

export async function markAllRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
}
