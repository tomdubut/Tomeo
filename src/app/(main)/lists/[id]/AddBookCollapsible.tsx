"use client"

import { useState } from "react"
import { Plus, ChevronUp } from "lucide-react"
import AddBookToListPanel from "./AddBookToListPanel"

interface Props {
  listId: string
  existingBookIds: string[]
}

export default function AddBookCollapsible({ listId, existingBookIds }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[--border] bg-[--card] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold transition-colors hover:bg-[--secondary]"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Ajouter des livres
        </span>
        <ChevronUp
          className="h-4 w-4 text-[--muted-foreground] transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-[--border] pt-4">
          <AddBookToListPanel listId={listId} existingBookIds={existingBookIds} />
        </div>
      )}
    </div>
  )
}
