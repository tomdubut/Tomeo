"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import Link from "next/link"
import { addBookToList } from "@/app/(main)/lists/actions"
import { ListPlus, ChevronDown, Check, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcDropdownPos } from "@/lib/utils/dropdown"

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

  function openDropdown() {
    if (!btnRef.current) return
    setDropdownPos(calcDropdownPos(btnRef.current.getBoundingClientRect(), 256, 220))
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function update() {
      if (!btnRef.current) return
      setDropdownPos(calcDropdownPos(btnRef.current.getBoundingClientRect(), 256, 220))
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

  const addedCount = inLists.size

  return (
    <div className="inline-block w-full">
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={openDropdown}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all border border-[--border]",
          addedCount > 0
            ? "bg-[--secondary]"
            : "bg-[--card] hover:bg-[--secondary]"
        )}
      >
        <ListPlus className="h-4 w-4 shrink-0" />
        {addedCount > 0 ? `${addedCount} liste${addedCount > 1 ? "s" : ""}` : "Ajouter à une liste"}
        <ChevronDown className={cn("h-4 w-4 shrink-0 ml-auto transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && dropdownPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-64 rounded-2xl border border-[--border] p-1.5"
            style={{ top: dropdownPos.top, left: dropdownPos.left, background: "var(--card)", boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)" }}
          >
            {lists.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-[--muted-foreground] mb-2">Aucune liste pour l&apos;instant.</p>
                <Link
                  href="/me/lists"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold bg-[--secondary] hover:opacity-80 transition-opacity"
                  onClick={() => setOpen(false)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Créer une liste
                </Link>
              </div>
            ) : (
              <>
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-[--muted-foreground] uppercase tracking-wide">Mes listes</p>
                {lists.map((list) => {
                  const isIn = inLists.has(list.id)
                  const isLoading = loadingId === list.id && isPending
                  return (
                    <button
                      key={list.id}
                      onClick={() => toggle(list)}
                      disabled={isIn || isLoading || isPending}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-colors",
                        isIn ? "font-semibold" : "hover:bg-[--secondary] font-medium"
                      )}
                    >
                      <span className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors",
                        isIn ? "border-[--foreground] bg-[--foreground]" : "border-[--border]"
                      )}>
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--background)" }} />
                        ) : isIn ? (
                          <Check className="h-3 w-3" style={{ color: "var(--background)" }} />
                        ) : null}
                      </span>
                      <span className="line-clamp-1">{list.title}</span>
                    </button>
                  )
                })}

                <div className="mt-1 pt-1 border-t border-[--border]">
                  <Link
                    href="/me/lists"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[--secondary] transition-colors"
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
