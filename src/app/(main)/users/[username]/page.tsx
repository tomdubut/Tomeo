import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MapPin, Globe, BookOpen, Star } from "lucide-react"
import FollowButton from "@/components/social/FollowButton"

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `@${username} — Tomeo` }
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single()

  if (!profile) notFound()

  // Counts
  const [{ count: bookCount }, { count: followerCount }, { count: followingCount }] =
    await Promise.all([
      supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    ])

  // Is the current user following this profile?
  let isFollowing = false
  if (currentUser && currentUser.id !== profile.id) {
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .single()
    isFollowing = !!data
  }

  const isOwnProfile = currentUser?.id === profile.id
  const initials = (profile.display_name ?? profile.username).slice(0, 2).toUpperCase()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-5">
        <Avatar className="h-20 w-20">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold">
                {profile.display_name ?? profile.username}
              </h1>
              <p className="text-sm text-[--muted-foreground]">@{profile.username}</p>
            </div>
            {isOwnProfile ? (
              <Button asChild variant="outline" size="sm">
                <a href="/settings">Modifier le profil</a>
              </Button>
            ) : currentUser ? (
              <FollowButton
                targetUserId={profile.id}
                initialIsFollowing={isFollowing}
              />
            ) : null}
          </div>

          {profile.bio && (
            <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-[--muted-foreground]">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {profile.location}
              </span>
            )}
            {profile.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                {profile.website_url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <StatBox label="Livres" value={bookCount ?? 0} icon={<BookOpen className="h-4 w-4" />} />
        <StatBox label="Abonnés" value={followerCount ?? 0} icon={<Star className="h-4 w-4" />} />
        <StatBox label="Abonnements" value={followingCount ?? 0} icon={<Star className="h-4 w-4" />} />
      </div>

      {/* Nav tabs */}
      <div className="flex gap-1 border-b border-[--border]">
        {[
          { label: "Bibliothèque", href: `/users/${profile.username}/library` },
          { label: "Critiques", href: `/users/${profile.username}/reviews` },
          { label: "Listes", href: `/users/${profile.username}/lists` },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="px-4 py-2 text-sm text-[--muted-foreground] hover:text-[--foreground] border-b-2 border-transparent transition-colors"
          >
            {label}
          </a>
        ))}
      </div>

      <p className="text-sm text-[--muted-foreground] text-center">
        Cliquez sur &ldquo;Bibliothèque&rdquo; pour voir les livres de {profile.display_name ?? profile.username}.
      </p>
    </div>
  )
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[--border] bg-[--card] p-4">
      <div className="flex items-center justify-center gap-1.5 text-[--muted-foreground] mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}
