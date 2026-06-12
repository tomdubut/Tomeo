"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

interface Props {
  targetUserId: string
  initialIsFollowing: boolean
}

export default function FollowButton({ targetUserId, initialIsFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (isFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
        setIsFollowing(false)
      } else {
        await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: targetUserId })
        setIsFollowing(true)
      }
    })
  }

  return (
    <Button
      onClick={toggle}
      disabled={isPending}
      variant={isFollowing ? "outline" : "default"}
      size="sm"
    >
      {isFollowing ? "Abonné" : "Suivre"}
    </Button>
  )
}
