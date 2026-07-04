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
      <div className="flex gap-5 items-start">
        <UserAvatar profile={profile} className="h-24 w-24 shrink-0 ring-2 ring-[--border]" />

        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold leading-tight">{displayName}</h1>
              <p className="text-sm text-[--muted-foreground] font-medium">@{profile.username}</p>
            </div>
            {isOwnProfile ? (
              <Button asChild variant="outline" size="sm">
                <a href="/settings">Modifier le profil</a>
              </Button>
            ) : currentUserId ? (
              <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
            ) : null}
          </div>

          {profile.bio && <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>}

          {isOwnProfile && (!profile.display_name || !profile.bio) && (
            <a href="/settings" className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80" style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              {!profile.display_name && !profile.bio
                ? "Ajoutez un nom et une bio pour compléter votre profil"
                : !profile.display_name
                  ? "Ajoutez un nom d'affichage pour compléter votre profil"
                  : "Ajoutez une bio pour compléter votre profil"}
            </a>
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

          <div className="mt-3 flex gap-5 text-sm">
            <div>
              <span className="font-bold text-base">{bookCount}</span>
              <span className="ml-1 text-[--muted-foreground]">Livres</span>
            </div>
            <Link href={`/users/${profile.username}/followers`} className="hover:underline">
              <span className="font-bold text-base">{followerCount}</span>
              <span className="ml-1 text-[--muted-foreground]">Abonnés</span>
            </Link>
            <Link href={`/users/${profile.username}/following`} className="hover:underline">
              <span className="font-bold text-base">{followingCount}</span>
              <span className="ml-1 text-[--muted-foreground]">Abonnements</span>
            </Link>
          </div>
        </div>
      </div>

      {children && (
        <>
          <div className="my-5 h-px bg-[--border]" />
          {children}
        </>
      )}
    </div>
  )
}
