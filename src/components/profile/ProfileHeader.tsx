import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MapPin, Globe, CircleAlert } from "lucide-react"
import FollowButton from "@/components/social/FollowButton"
import UserAvatar from "@/components/ui/UserAvatar"
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
      {/* Top row: avatar + name/stats */}
      <div className="flex items-center gap-4 sm:gap-6">
        <UserAvatar profile={profile} className="h-[72px] w-[72px] sm:h-24 sm:w-24 shrink-0 ring-2 ring-[--border]" />

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate">{displayName}</h1>
          <p className="text-sm text-[--muted-foreground] font-medium">@{profile.username}</p>

          <div className="mt-2 flex gap-4 sm:gap-5 text-sm">
            <div>
              <span className="font-bold">{bookCount}</span>
              <span className="ml-1 text-[--muted-foreground] text-xs">Livres</span>
            </div>
            <Link href={`/users/${profile.username}/followers`} className="hover:underline">
              <span className="font-bold">{followerCount}</span>
              <span className="ml-1 text-[--muted-foreground] text-xs">Abonnés</span>
            </Link>
            <Link href={`/users/${profile.username}/following`} className="hover:underline">
              <span className="font-bold">{followingCount}</span>
              <span className="ml-1 text-[--muted-foreground] text-xs">Abonnements</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bio / location / website */}
      <div className="mt-3 space-y-1.5">
        {profile.bio && <p className="text-sm leading-relaxed">{profile.bio}</p>}

        {(profile.location || profile.website_url) && (
          <div className="flex flex-wrap gap-3 text-sm text-[--muted-foreground]">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{profile.location}
              </span>
            )}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline min-w-0">
                <Globe className="h-3.5 w-3.5 shrink-0" /><span className="truncate max-w-[180px]">{profile.website_url.replace(/^https?:\/\//, "")}</span>
              </a>
            )}
          </div>
        )}

        {isOwnProfile && (!profile.display_name || !profile.bio) && (
          <a href="/settings" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80" style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            <CircleAlert className="h-3.5 w-3.5 shrink-0" />
            {!profile.display_name && !profile.bio
              ? "Ajoutez un nom et une bio pour compléter votre profil"
              : !profile.display_name
                ? "Ajoutez un nom d'affichage pour compléter votre profil"
                : "Ajoutez une bio pour compléter votre profil"}
          </a>
        )}
      </div>

      {/* Action button */}
      {isOwnProfile ? (
        <div className="mt-3">
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <a href="/settings">Modifier le profil</a>
          </Button>
        </div>
      ) : currentUserId ? (
        <div className="mt-3">
          <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
        </div>
      ) : null}

      {children && (
        <>
          <div className="my-5 h-px bg-[--border]" />
          {children}
        </>
      )}
    </div>
  )
}
