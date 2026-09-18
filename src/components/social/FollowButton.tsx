"use client"

import { useState, useTransition } from "react"
import { followUser, unfollowUser } from "@/app/(main)/users/actions"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
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

  if (isFollowing) {
    return (
      <Button
        onClick={toggle}
        disabled={isPending}
        size="sm"
        className="gap-1.5 font-semibold"
        style={{ background: "color-mix(in srgb, #22c55e 15%, var(--card))", color: "#16a34a", border: "1px solid color-mix(in srgb, #22c55e 35%, transparent)" }}
      >
        <Check className="h-3.5 w-3.5" />
        Abonné
      </Button>
    )
  }

  return (
    <Button
      onClick={toggle}
      disabled={isPending}
      variant="default"
      size="sm"
    >
      Suivre
    </Button>
  )
}
