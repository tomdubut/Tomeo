"use client"

import { useState, useTransition } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteList } from "@/app/(main)/lists/actions"

export default function DeleteListButton({ listId }: { listId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteList(listId)
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[--muted-foreground] hidden sm:block">Supprimer ?</span>
        <Button
          size="sm"
          variant="ghost"
          className="text-[--destructive] font-semibold"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Oui"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={isPending}>
          Non
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-[--destructive]"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
