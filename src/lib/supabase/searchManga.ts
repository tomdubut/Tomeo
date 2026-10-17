import type { SupabaseClient } from "@supabase/supabase-js"

export type MangaSearchResult = {
  id: string
  title_fr: string
  author: string | null
  publisher: string | null
  cover_url: string | null
  volume_count: number | null
}

/** Manga search, ranked and tolerant of typos, plurals, accents and alternative
 *  titles (English, romaji). The logic lives in the search_manga() SQL function. */
export async function searchManga(supabase: SupabaseClient, q: string, maxResults: number): Promise<MangaSearchResult[]> {
  const { data, error } = await supabase.rpc("search_manga", { q, max_results: maxResults })
  if (error) throw error
  return (data ?? []) as MangaSearchResult[]
}
