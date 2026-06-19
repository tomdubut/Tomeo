"use client"

import { useState, useTransition } from "react"
import { followUser, unfollowUser } from "@/app/(main)/users/actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Props {
  targetUserId: string
  initialIsFollowing: boolean
}

export default function FollowButton({ targetUserId, initialIsFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      if (isFollowing) {
        await unfollowUser(targetUserId)
        setIsFollowing(false)
        toast.success("Abonnement retiré")
      } else {
        await followUser(targetUserId)
        setIsFollowing(true)
        toast.success("Abonnement ajouté")
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
