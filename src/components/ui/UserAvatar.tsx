"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User } from "lucide-react"
import { getProfileColor } from "@/lib/utils/profileColor"

interface Props {
  profile: { username: string; avatar_url?: string | null; profile_color?: string | null }
  className?: string
}

export default function UserAvatar({ profile, className }: Props) {
  const color = getProfileColor(profile.username, profile.profile_color)
  return (
    <Avatar className={className}>
      <AvatarImage src={profile.avatar_url ?? undefined} />
      <AvatarFallback style={{ background: color }}>
        <User className="h-1/2 w-1/2" style={{ color: "rgba(255,255,255,0.8)" }} />
      </AvatarFallback>
    </Avatar>
  )
}
