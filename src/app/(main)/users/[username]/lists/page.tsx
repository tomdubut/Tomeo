
import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import ListCard from "@/components/lists/ListCard"
import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileSubNav from "@/components/profile/ProfileSubNav"
import { Button } from "@/components/ui/button"
import { BookOpen, Plus } from "lucide-react"

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `Listes de @${username} — Tomesie` }
}

export default async function UserListsPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase.from("profiles").select("*").eq("username", username).single()
  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const isOwn = currentUser?.id === profile.id

  let isFollowing = false
  if (currentUser && !isOwn) {
    const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", currentUser.id).eq("following_id", profile.id).single()
    isFollowing = !!data
  }

  const [{ count: bookCount }, { count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
  ])

  const query = supabase.from("lists").select("id, title, description, is_public, created_at").eq("user_id", profile.id).order("created_at", { ascending: false })
  const { data: lists } = isOwn ? await query : await query.eq("is_public", true)

  const listIds = (lists ?? []).map((l) => l.id)
  const { data: listBooks } = listIds.length
    ? await supabase.from("list_books").select("list_id, book:books(cover_url)").in("list_id", listIds).order("position", { ascending: true })
    : { data: [] }

  const metaMap = (listBooks ?? []).reduce<Record<string, { count: number; covers: (string | null)[] }>>((acc, lb) => {
    if (!acc[lb.list_id]) acc[lb.list_id] = { count: 0, covers: [] }
    acc[lb.list_id].count++
    if (acc[lb.list_id].covers.length < 4) acc[lb.list_id].covers.push((lb.book as unknown as { cover_url: string | null } | null)?.cover_url ?? null)
    return acc
  }, {})

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-4xl mx-auto">

      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwn}
        currentUserId={currentUser?.id ?? null}
        isFollowing={isFollowing}
        bookCount={bookCount ?? 0}
        followerCount={followerCount ?? 0}
        followingCount={followingCount ?? 0}
      />

      <div className="rounded-2xl bg-[--card] p-6 sm:p-8 space-y-6">
        <ProfileSubNav username={username} />

        {/* Lists header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[--muted-foreground] font-medium">{lists?.length ?? 0} liste{(lists?.length ?? 0) !== 1 ? "s" : ""}</p>
          {isOwn && (
            <Button asChild size="sm">
              <Link href="/me/lists"><Plus className="h-4 w-4" />Nouvelle liste</Link>
            </Button>
          )}
        </div>

        {!lists?.length ? (
          <div className="px-6 py-10 sm:p-14 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
              <BookOpen className="h-8 w-8 text-[--primary]" />
            </div>
            <p className="text-lg font-bold">
              {isOwn ? "Vous n'avez pas encore créé de liste" : `${displayName} n'a pas encore de liste publique`}
            </p>
            {isOwn ? (
              <>
                <p className="mt-2 text-sm text-[--muted-foreground]">Organisez vos lectures par thème, humeur ou projet.</p>
                <div className="mt-5">
                  <Button asChild><Link href="/me/lists">Créer une liste</Link></Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-[--muted-foreground]">Revenez plus tard ou explorez le catalogue.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {lists.map((list) => {
              const meta = metaMap[list.id] ?? { count: 0, covers: [] }
              return <ListCard key={list.id} list={{ ...list, book_count: meta.count, covers: meta.covers }} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}
