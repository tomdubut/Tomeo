
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import UserAvatar from "@/components/ui/UserAvatar"
import FollowButton from "@/components/social/FollowButton"
import UserSearchBar from "@/components/social/UserSearchBar"

interface Props {
  searchParams: Promise<{ q?: string }>
}

export const metadata = { title: "Lecteurs — Tomesie" }

export default async function UsersPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { q } = await searchParams
  const query = q?.trim() ?? ""

  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
  const followingIds = new Set((followRows ?? []).map((r) => r.following_id))

  let profiles: any[] = []
  let suggested: any[] = []

  if (query) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("id", user.id)
      .order("username")
      .limit(20)
    profiles = data ?? []
  } else {
    // Fetch suggested users: most followed, excluding self
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .neq("id", user.id)
      .order("created_at", { ascending: true })
      .limit(12)
    suggested = data ?? []
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Trouver des lecteurs</h1>
        <p className="mt-1 text-sm text-[--muted-foreground]">Recherchez par nom ou nom d&apos;utilisateur</p>
      </div>

      <UserSearchBar initialQuery={query} />

      {!query && suggested.length > 0 && (
        <div className="space-y-4">
          <p className="font-semibold">À découvrir</p>
          <div className="space-y-3">
            {suggested.map((profile) => {
              const displayName = profile.display_name ?? profile.username
              const isFollowing = followingIds.has(profile.id)
              return (
                <div key={profile.id} className="flex items-center gap-4 rounded-2xl bg-[--card] px-4 py-3 sm:px-5 sm:py-4">
                  <Link href={`/users/${profile.username}`} className="shrink-0">
                    <UserAvatar profile={profile} className="h-12 w-12 ring-2 ring-[--border]" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/users/${profile.username}`} className="hover:underline">
                      <p className="font-bold leading-tight">{displayName}</p>
                    </Link>
                    <p className="text-sm text-[--muted-foreground]">@{profile.username}</p>
                    {profile.bio && (
                      <p className="mt-1 text-sm text-[--muted-foreground] line-clamp-1">{profile.bio}</p>
                    )}
                  </div>
                  <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {query && profiles.length === 0 && (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center">
          <p className="text-lg font-bold">Aucun résultat pour &ldquo;{query}&rdquo;</p>
          <p className="mt-2 text-sm text-[--muted-foreground]">Essayez un autre nom ou pseudo.</p>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="space-y-3">
          {profiles.map((profile) => {
            const displayName = profile.display_name ?? profile.username
            const isFollowing = followingIds.has(profile.id)
            return (
              <div key={profile.id} className="flex items-center gap-4 rounded-2xl bg-[--card] px-4 py-3 sm:px-5 sm:py-4">
                <Link href={`/users/${profile.username}`} className="shrink-0">
                  <UserAvatar profile={profile} className="h-12 w-12 ring-2 ring-[--border]" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${profile.username}`} className="hover:underline">
                    <p className="font-bold leading-tight">{displayName}</p>
                  </Link>
                  <p className="text-sm text-[--muted-foreground]">@{profile.username}</p>
                  {profile.bio && (
                    <p className="mt-1 text-sm text-[--muted-foreground] line-clamp-1">{profile.bio}</p>
                  )}
                </div>
                <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
