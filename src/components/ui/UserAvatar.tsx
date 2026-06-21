"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileColor } from "@/lib/utils/profileColor"

interface Props {
  profile: { username: string; display_name?: string | null; avatar_url?: string | null; profile_color?: string | null }
  className?: string
}

export default function UserAvatar({ profile, className }: Props) {
  const color = getProfileColor(profile.username, profile.profile_color)
  const initial = (profile.display_name ?? profile.username ?? "?")[0].toUpperCase()

  return (
    <Avatar className={className}>
      <AvatarImage src={profile.avatar_url ?? undefined} />
      <AvatarFallback style={{ background: color, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}
