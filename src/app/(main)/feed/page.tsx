
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import FeedList from "@/components/feed/FeedList"
import type { ActivityRow } from "./actions"

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)

  const followingIds = followRows?.map((r) => r.following_id) ?? []

  const { data: raw } = followingIds.length
    ? await supabase
        .from("activity_feed")
        .select(`
          id, activity_type, created_at,
          actor:profiles!actor_id(username, display_name, avatar_url),
          book:books(id, title, cover_url),
          review:reviews(id, body, is_spoiler),
          list:lists(id, title)
        `)
        .in("actor_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] }

  const activities = (raw ?? []) as unknown as ActivityRow[]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">
        Bonjour, {profile.display_name ?? profile.username} 👋
      </h1>

      {!activities.length ? (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
            <Users className="h-8 w-8 text-[--primary]" />
          </div>
          <p className="text-lg font-bold">Votre fil est vide pour l&apos;instant</p>
          <p className="mt-2 text-sm text-[--muted-foreground] max-w-xs mx-auto">
            Suivez des lecteurs pour voir leurs critiques et activité ici. Vous pouvez aussi explorer le catalogue et découvrir des livres.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/users">Découvrir des lecteurs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/books">Explorer le catalogue</Link>
            </Button>
          </div>
        </div>
      ) : (
        <FeedList initialActivities={activities} />
      )}
    </div>
  )
}
