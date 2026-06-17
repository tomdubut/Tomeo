import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import FollowButton from "@/components/social/FollowButton"
import UserSearchBar from "@/components/social/UserSearchBar"
import { Users } from "lucide-react"

interface Props {
  searchParams: Promise<{ q?: string }>
}

export const metadata = { title: "Lecteurs — Tomeo" }

export default async function UsersPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { q } = await searchParams
  const query = q?.trim() ?? ""

  // Fetch following IDs so we can show correct button state
  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
  const followingIds = new Set((followRows ?? []).map((r) => r.following_id))

  let profiles: any[] = []

  if (query) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("id", user.id)
      .order("username")
      .limit(20)
    profiles = data ?? []
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Trouver des lecteurs</h1>
        <p className="mt-1 text-sm text-[--muted-foreground]">Recherchez par nom ou nom d&apos;utilisateur</p>
      </div>

      <UserSearchBar initialQuery={query} />

      {!query && (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center border border-[--border]">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
            <Users className="h-8 w-8 text-[--primary]" />
          </div>
          <p className="text-lg font-bold">Recherchez un lecteur</p>
          <p className="mt-2 text-sm text-[--muted-foreground]">
            Tapez un nom ou un pseudo pour trouver des lecteurs à suivre.
          </p>
        </div>
      )}

      {query && profiles.length === 0 && (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center border border-[--border]">
          <p className="text-lg font-bold">Aucun résultat pour &ldquo;{query}&rdquo;</p>
          <p className="mt-2 text-sm text-[--muted-foreground]">Essayez un autre nom ou pseudo.</p>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="space-y-3">
          {profiles.map((profile) => {
            const displayName = profile.display_name ?? profile.username
            const initials = displayName.slice(0, 2).toUpperCase()
            const isFollowing = followingIds.has(profile.id)

            return (
              <div
                key={profile.id}
                className="flex items-center gap-4 rounded-2xl bg-[--card] px-4 py-3 sm:px-5 sm:py-4 border border-[--border]"
              >
                <Link href={`/users/${profile.username}`} className="shrink-0">
                  <Avatar className="h-12 w-12 ring-2 ring-[--border]">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[--secondary] font-bold">{initials}</AvatarFallback>
                  </Avatar>
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
