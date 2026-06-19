"use client"

import { useTransition } from "react"
import { Check } from "lucide-react"
import { PROFILE_COLORS } from "@/lib/utils/profileColor"
import { updateProfileColor } from "@/app/(main)/settings/actions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Props {
  currentColor: string | null
}

export default function ProfileColorPicker({ currentColor }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleSelect(color: string) {
    startTransition(async () => {
      await updateProfileColor(color)
      toast.success("Couleur mise à jour")
    })
  }

  return (
    <div className="flex flex-wrap gap-3">
      {PROFILE_COLORS.map((color) => {
        const isActive = currentColor === color
        return (
          <button
            key={color}
            onClick={() => handleSelect(color)}
            disabled={isPending}
            className={cn(
              "w-8 h-8 rounded-full cursor-pointer ring-2 ring-offset-2 transition-all",
              isActive ? "ring-[--foreground]" : "ring-transparent"
            )}
            style={{ background: color }}
            aria-label={color}
          >
            {isActive && (
              <Check className="h-4 w-4 mx-auto text-white" strokeWidth={3} />
            )}
          </button>
        )
      })}
    </div>
  )
}
