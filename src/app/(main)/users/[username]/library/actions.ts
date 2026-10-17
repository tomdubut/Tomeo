"use server"

import { createClient } from "@/lib/supabase/server"
import { clamp, isUuid } from "@/lib/validation"

export interface LibraryBookCard {
  book_id: string
  status: string
  finished_at: string | null
  book: {
    id: string
    title: string
    cover_url: string | null
    avg_rating: number | null
    book_authors: Array<{
      display_order: number
      role: string
      author: { name: string } | null
    }>
  } | null
  rating?: number
}

export async function loadMoreLibraryBooks({
  profileId,
  orderedBookIds,
  offset,
  pageSize,
  ratingByBook,
}: {
  profileId: string
  orderedBookIds: string[]
  offset: number
  pageSize: number
  ratingByBook: Record<string, number>
}): Promise<LibraryBookCard[]> {
  if (!isUuid(profileId) || !Array.isArray(orderedBookIds)) return []
  const start = clamp(offset, 0, orderedBookIds.length)
  const pageIds = orderedBookIds.slice(start, start + clamp(pageSize, 1, 48)).filter(isUuid)
  if (!pageIds.length) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from("user_books")
    .select(`status, finished_at, book_id, book:books(id, title, cover_url, avg_rating, book_authors(display_order, role, author:authors(name)))`)
    .eq("user_id", profileId)
    .in("book_id", pageIds)

  if (!data) return []

  const map = new Map((data as any[]).map((b) => [b.book_id, b]))
  return pageIds
    .map((id) => {
      const row = map.get(id)
      if (!row) return null
      return { ...row, rating: ratingByBook[id] }
    })
    .filter((b): b is LibraryBookCard => !!b)
}
