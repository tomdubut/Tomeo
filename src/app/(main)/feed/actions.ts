"use server"

import { createClient } from "@/lib/supabase/server"

export type ActivityRow = {
  id: string
  activity_type: string
  created_at: string
  actor: { username: string; display_name: string | null; avatar_url: string | null } | null
  book: { id: string; title: string; cover_url: string | null } | null
  review: { id: string; body: string; is_spoiler: boolean } | null
  list: { id: string; title: string } | null
}

export async function loadMoreFeedActivities({
  cursor,
  limit = 20,
}: {
  cursor: string
  limit?: number
}): Promise<ActivityRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)

  const followingIds = followRows?.map((r) => r.following_id) ?? []
  if (!followingIds.length) return []

  const { data } = await supabase
    .from("activity_feed")
    .select(`
      id, activity_type, created_at,
      actor:profiles!actor_id(username, display_name, avatar_url),
      book:books(id, title, cover_url),
      review:reviews(id, body, is_spoiler),
      list:lists(id, title)
    `)
    .in("actor_id", followingIds)
    .lt("created_at", cursor)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []) as unknown as ActivityRow[]
}
