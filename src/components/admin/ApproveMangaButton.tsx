"use client"

import { useState, useTransition } from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { approveManga } from "@/app/(main)/admin/actions"

/** "Valider" on a manga flagged by the import: one click, the row then shows as done. */
export default function ApproveMangaButton({ id }: { id: string }) {
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (done) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-read"><Check className="h-3.5 w-3.5" />Validé</span>

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const { error } = await approveManga(id)
          if (error) toast.error(error)
          else setDone(true)
        })
      }
    >
      <Check className="h-3.5 w-3.5" />
      Valider
    </Button>
  )
}
