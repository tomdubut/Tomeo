import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MapPin, Globe } from "lucide-react"
import FollowButton from "@/components/social/FollowButton"
import type { Profile } from "@/lib/types"

interface Props {
  profile: Profile
  isOwnProfile: boolean
  currentUserId: string | null
  isFollowing: boolean
  bookCount: number
  followerCount: number
  followingCount: number
  children?: React.ReactNode
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  currentUserId,
  isFollowing,
  bookCount,
  followerCount,
  followingCount,
  children,
}: Props) {
  const displayName = profile.display_name ?? profile.username

  return (
    <div className="mb-8">
      {/* Banner */}
      <div
        className="-mx-4 h-32 sm:h-40"
        style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" }}
      />

      {/* Avatar + actions row */}
      <div className="-mt-12 px-1 flex items-end justify-between gap-4">
        <Avatar className="h-24 w-24 ring-4 ring-[--background]">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-[--secondary] text-[--foreground] text-2xl font-bold">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="pb-1">
          {isOwnProfile ? (
            <Button asChild variant="outline" size="sm">
              <a href="/settings">Modifier le profil</a>
            </Button>
          ) : currentUserId ? (
            <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
          ) : null}
        </div>
      </div>

      {/* Name + bio */}
      <div className="mt-3 px-1">
        <h1 className="text-2xl font-bold leading-tight">{displayName}</h1>
        <p className="text-sm text-[--muted-foreground] font-medium">@{profile.username}</p>

        {profile.bio && (
          <p className="mt-2 text-sm leading-relaxed max-w-lg">{profile.bio}</p>
        )}

        <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-[--muted-foreground]">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />{profile.location}
            </span>
          )}
          {profile.website_url && (
            <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
              <Globe className="h-3.5 w-3.5" />{profile.website_url.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <span className="font-bold text-[--foreground]">{bookCount}</span>
            <span className="ml-1 text-[--muted-foreground]">Livres</span>
          </div>
          <Link href={`/users/${profile.username}/followers`} className="hover:underline">
            <span className="font-bold text-[--foreground]">{followerCount}</span>
            <span className="ml-1 text-[--muted-foreground]">Abonnés</span>
          </Link>
          <Link href={`/users/${profile.username}/following`} className="hover:underline">
            <span className="font-bold text-[--foreground]">{followingCount}</span>
            <span className="ml-1 text-[--muted-foreground]">Abonnements</span>
          </Link>
        </div>
      </div>

      {children && (
        <>
          <div className="mt-6 h-px bg-[--border]" />
          <div className="mt-6">{children}</div>
        </>
      )}
    </div>
  )
}
