import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import UserAvatar from "@/components/ui/UserAvatar"
import FollowButton from "@/components/social/FollowButton"

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `Abonnés de @${username} — Tomeo` }
}

export default async function FollowersPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase.from("profiles").select("id, username, display_name").eq("username", username).single()
  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: follows } = await supabase
    .from("follows")
    .select("follower:profiles!follower_id(id, username, display_name, avatar_url, bio)")
    .eq("following_id", profile.id)
    .order("created_at", { ascending: false })

  const followers = (follows ?? []).map((f: any) => f.follower).filter(Boolean)

  // Check which ones the current user follows
  let currentUserFollowingIds = new Set<string>()
  if (currentUser && followers.length) {
    const { data: myFollows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUser.id)
      .in("following_id", followers.map((f: any) => f.id))
    currentUserFollowingIds = new Set((myFollows ?? []).map((f: any) => f.following_id))
  }

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/users/${username}/library`} className="text-sm text-[--muted-foreground] hover:underline">
          ← {displayName}
        </Link>
        <h1 className="text-xl font-extrabold mt-1">Abonnés</h1>
        <p className="text-sm text-[--muted-foreground]">{followers.length} personne{followers.length !== 1 ? "s" : ""} suivent @{username}</p>
      </div>

      {followers.length === 0 ? (
        <div className="rounded-2xl bg-[--card] px-6 py-10 text-center">
          <p className="text-sm text-[--muted-foreground]">Personne ne suit encore @{username}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {followers.map((follower: any) => {
            const name = follower.display_name ?? follower.username
            const isOwn = currentUser?.id === follower.id
            return (
              <div key={follower.id} className="flex items-center gap-4 rounded-2xl bg-[--card] p-4">
                <Link href={`/users/${follower.username}/library`}>
                  <UserAvatar profile={follower} className="h-11 w-11 shrink-0" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${follower.username}/library`} className="font-semibold text-sm hover:underline">{name}</Link>
                  <p className="text-xs text-[--muted-foreground]">@{follower.username}</p>
                  {follower.bio && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{follower.bio}</p>}
                </div>
                {currentUser && !isOwn && (
                  <FollowButton
                    targetUserId={follower.id}
                    initialIsFollowing={currentUserFollowingIds.has(follower.id)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
