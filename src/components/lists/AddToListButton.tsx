"use client"

import { useState, useTransition, useRef, useEffect } from "react"
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
  initialListIds: string[]
}

export default function AddToListButton({ bookId, lists, initialListIds }: Props) {
  const [open, setOpen] = useState(false)
  const [inLists, setInLists] = useState<Set<string>>(new Set(initialListIds))
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function calcPos(rect: DOMRect) {
    const dropdownWidth = 256 // w-64
    const dropdownHeight = 220
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < dropdownHeight
    const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8)
    return {
      top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: Math.max(8, left),
    }
  }

  function openDropdown() {
    if (!btnRef.current) return
    setDropdownPos(calcPos(btnRef.current.getBoundingClientRect()))
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function update() {
      if (!btnRef.current) return
      setDropdownPos(calcPos(btnRef.current.getBoundingClientRect()))
    }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [open])

  function toggle(list: UserList) {
    if (inLists.has(list.id)) return
    setLoadingId(list.id)
    startTransition(async () => {
      await addBookToList(list.id, bookId)
      setInLists((prev) => new Set([...prev, list.id]))
      setLoadingId(null)
    })
  }

  return (
    <div className="inline-block">
      <Button
        ref={btnRef}
        variant="outline"
        size="sm"
        onClick={openDropdown}
        className="gap-2 w-full"
      >
        <ListPlus className="h-4 w-4" />
        Ajouter à une liste
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </Button>

      {open && dropdownPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-64 rounded-2xl border border-[--border] overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left, background: "var(--background)", boxShadow: "var(--shadow-lg)" }}
          >
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
                        isIn ? "text-[--muted-foreground] cursor-default" : "hover:bg-[--secondary]"
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
