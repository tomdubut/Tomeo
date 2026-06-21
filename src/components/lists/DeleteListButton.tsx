"use client"

import { useState, useTransition } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteList } from "@/app/(main)/lists/actions"

export default function DeleteListButton({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteList(listId)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-[--destructive]"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => !isPending && setOpen(false)}
          />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 space-y-4"
            style={{ background: "var(--card)", boxShadow: "var(--shadow-lg)" }}>
            <div className="space-y-1">
              <p className="text-base font-bold">Supprimer cette liste ?</p>
              <p className="text-sm text-[--muted-foreground]">
                Cette action est irréversible. La liste et tous ses livres seront supprimés définitivement.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
