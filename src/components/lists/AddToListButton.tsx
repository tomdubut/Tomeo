"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { addBookToList } from "@/app/(main)/lists/actions"
import { Button } from "@/components/ui/button"
import { ListPlus, ChevronDown, Check, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface UserList {
  id: string
  title: string
  is_public: boolean
}

interface Props {
  bookId: string
  lists: UserList[]
  initialListIds: string[] // lists this book is already in
}

export default function AddToListButton({ bookId, lists, initialListIds }: Props) {
  const [open, setOpen] = useState(false)
  const [inLists, setInLists] = useState<Set<string>>(new Set(initialListIds))
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(list: UserList) {
    if (inLists.has(list.id)) return // remove not supported from here — go to list page
    setLoadingId(list.id)
    startTransition(async () => {
      await addBookToList(list.id, bookId)
      setInLists((prev) => new Set([...prev, list.id]))
      setLoadingId(null)
    })
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        className="gap-2"
      >
        <ListPlus className="h-4 w-4" />
        Ajouter à une liste
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-2xl border border-[--border] bg-[--card] overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }}>
            {lists.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[--muted-foreground]">
                <p>Aucune liste pour l&apos;instant.</p>
                <Link
                  href="/me/lists"
                  className="mt-1 flex items-center gap-1 text-[--foreground] hover:underline font-medium"
                  onClick={() => setOpen(false)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Créer une liste
                </Link>
              </div>
            ) : (
              <>
                {lists.map((list) => {
                  const isIn = inLists.has(list.id)
                  const isLoading = loadingId === list.id && isPending
                  return (
                    <button
                      key={list.id}
                      onClick={() => toggle(list)}
                      disabled={isIn || isLoading || isPending}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors",
                        isIn
                          ? "text-[--muted-foreground] cursor-default"
                          : "hover:bg-[--secondary]"
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : isIn ? (
                        <Check className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 shrink-0 rounded border border-[--border]" />
                      )}
                      <span className="line-clamp-1">{list.title}</span>
                    </button>
                  )
                })}
                <div className="border-t border-[--border]">
                  <Link
                    href="/me/lists"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[--secondary] transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Nouvelle liste
                  </Link>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
