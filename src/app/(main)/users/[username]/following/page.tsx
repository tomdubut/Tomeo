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
  return { title: `Abonnements de @${username} — Tomeo` }
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase.from("profiles").select("id, username, display_name").eq("username", username).single()
  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: follows } = await supabase
    .from("follows")
    .select("following:profiles!following_id(id, username, display_name, avatar_url, bio)")
    .eq("follower_id", profile.id)
    .order("created_at", { ascending: false })

  const following = (follows ?? []).map((f: any) => f.following).filter(Boolean)

  // Check which ones the current user follows
  let currentUserFollowingIds = new Set<string>()
  if (currentUser && following.length) {
    const { data: myFollows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUser.id)
      .in("following_id", following.map((f: any) => f.id))
    currentUserFollowingIds = new Set((myFollows ?? []).map((f: any) => f.following_id))
  }

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/users/${username}/library`} className="text-sm text-[--muted-foreground] hover:underline">
          ← {displayName}
        </Link>
        <h1 className="text-xl font-extrabold mt-1">Abonnements</h1>
        <p className="text-sm text-[--muted-foreground]">@{username} suit {following.length} personne{following.length !== 1 ? "s" : ""}</p>
      </div>

      {following.length === 0 ? (
        <div className="rounded-2xl bg-[--card] px-6 py-10 text-center">
          <p className="text-sm text-[--muted-foreground]">@{username} ne suit encore personne.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {following.map((followed: any) => {
            const name = followed.display_name ?? followed.username
            const isOwn = currentUser?.id === followed.id
            return (
              <div key={followed.id} className="flex items-center gap-4 rounded-2xl bg-[--card] p-4">
                <Link href={`/users/${followed.username}/library`}>
                  <UserAvatar profile={followed} className="h-11 w-11 shrink-0" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${followed.username}/library`} className="font-semibold text-sm hover:underline">{name}</Link>
                  <p className="text-xs text-[--muted-foreground]">@{followed.username}</p>
                  {followed.bio && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{followed.bio}</p>}
                </div>
                {currentUser && !isOwn && (
                  <FollowButton
                    targetUserId={followed.id}
                    initialIsFollowing={currentUserFollowingIds.has(followed.id)}
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
