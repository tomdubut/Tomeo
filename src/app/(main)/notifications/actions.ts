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

/** Unread count for the bell, re-checked while the app stays open (the navbar doesn't re-render on navigation). */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null)
  return count ?? 0
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
