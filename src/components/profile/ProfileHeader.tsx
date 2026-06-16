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
    <div className="rounded-3xl bg-[--secondary] p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="flex justify-center sm:block">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-[--primary] text-black" />
          </Avatar>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-3xl font-semibold">{displayName}</h1>
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

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-[--muted-foreground]">
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

          <div className="mt-4 flex gap-5 text-sm">
            <div className="text-center">
              <p className="text-2xl font-semibold leading-none">{bookCount}</p>
              <p className="text-[--muted-foreground] mt-0.5">Livres</p>
            </div>
            <div className="w-px bg-[--border]" />
            <Link href={`/users/${profile.username}/followers`} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-2xl font-semibold leading-none">{followerCount}</p>
              <p className="text-[--muted-foreground] mt-0.5">Abonnés</p>
            </Link>
            <div className="w-px bg-[--border]" />
            <Link href={`/users/${profile.username}/following`} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-2xl font-semibold leading-none">{followingCount}</p>
              <p className="text-[--muted-foreground] mt-0.5">Abonnements</p>
            </Link>
          </div>
        </div>
      </div>

      {children && (
        <>
          <div className="my-6 h-px bg-[--border]" />
          {children}
        </>
      )}
    </div>
  )
}
