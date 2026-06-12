"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { setReadingStatus } from "@/app/(main)/books/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, ChevronDown, BookOpen, BookMarked, BookCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Status = "want_to_read" | "currently_reading" | "read" | null

const STATUS_LABELS: Record<NonNullable<Status>, { label: string; icon: React.ReactNode }> = {
  want_to_read: { label: "À lire", icon: <BookMarked className="h-4 w-4" /> },
  currently_reading: { label: "En cours", icon: <BookOpen className="h-4 w-4" /> },
  read: { label: "Lu", icon: <BookCheck className="h-4 w-4" /> },
}

interface Props {
  bookId: string
  initialStatus: Status
  initialFinishedAt?: string | null
}

export default function AddToLibraryButton({ bookId, initialStatus, initialFinishedAt }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [open, setOpen] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [finishedAt, setFinishedAt] = useState<string>(
    initialFinishedAt ?? new Date().toISOString().slice(0, 10)
  )
  const [isPending, startTransition] = useTransition()
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const chevronRef = useRef<HTMLButtonElement>(null)

  function openDropdown() {
    if (!chevronRef.current) return
    const rect = chevronRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 160 // approximate
    const openUpward = spaceBelow < dropdownHeight
    setDropdownPos(
      openUpward
        ? { top: rect.top - dropdownHeight - 4, left: rect.left }
        : { top: rect.bottom + 4, left: rect.left }
    )
    setShowDatePicker(false)
    setOpen(true)
  }

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    function update() {
      if (!chevronRef.current) return
      const rect = chevronRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropdownHeight = 160
      const openUpward = spaceBelow < dropdownHeight
      setDropdownPos(
        openUpward
          ? { top: rect.top - dropdownHeight - 4, left: rect.left }
          : { top: rect.bottom + 4, left: rect.left }
      )
    }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [open])

  function choose(next: Status) {
    setOpen(false)
    if (next === "read") {
      setShowDatePicker(true)
      return
    }
    commitStatus(next, null)
  }

  function commitStatus(next: Status, date: string | null) {
    startTransition(async () => {
      await setReadingStatus(bookId, next, date)
      setStatus(next)
    })
  }

  function confirmRead() {
    setShowDatePicker(false)
    commitStatus("read", finishedAt)
  }

  const current = status ? STATUS_LABELS[status] : null

  return (
    <div className="space-y-3">
      {showDatePicker && (
        <div className="rounded-lg border border-[--border] bg-[--card] p-4 space-y-3 max-w-xs">
          <div className="space-y-1.5">
            <Label htmlFor="finished_at">Date de fin de lecture</Label>
            <Input
              id="finished_at"
              type="date"
              value={finishedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFinishedAt(e.target.value)}
            />
            <p className="text-xs text-[--muted-foreground]">Optionnel — vous pouvez modifier cette date plus tard.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmRead} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDatePicker(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {status === "read" && initialFinishedAt && !showDatePicker && (
        <p className="text-xs text-[--muted-foreground]">
          Terminé le{" "}
          <button
            className="underline underline-offset-2 hover:text-[--foreground]"
            onClick={() => setShowDatePicker(true)}
          >
            {new Date(initialFinishedAt).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </button>
        </p>
      )}

      <div className="inline-flex">
        <Button
          onClick={() => !status && choose("want_to_read")}
          disabled={isPending}
          variant={status ? "secondary" : "default"}
          className="rounded-r-none pr-3 gap-2"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : current ? (
            <>{current.icon}{current.label}<Check className="h-3.5 w-3.5 ml-0.5" /></>
          ) : (
            "Ajouter à ma bibliothèque"
          )}
        </Button>
        <Button
          ref={chevronRef}
          onClick={openDropdown}
          disabled={isPending}
          variant={status ? "secondary" : "default"}
          className="rounded-l-none border-l border-[--border] px-2"
          aria-label="Choisir un statut"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {open && dropdownPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-52 rounded-2xl border border-[--border] bg-[--card] overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left, boxShadow: "var(--shadow-lg)" }}
          >
            {(Object.entries(STATUS_LABELS) as [NonNullable<Status>, (typeof STATUS_LABELS)[keyof typeof STATUS_LABELS]][]).map(
              ([key, { label, icon }]) => (
                <button
                  key={key}
                  onClick={() => choose(key)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[--secondary] transition-colors",
                    status === key && "font-medium"
                  )}
                >
                  {icon}{label}
                  {status === key && <Check className="ml-auto h-3.5 w-3.5" />}
                </button>
              )
            )}
            {status && (
              <>
                <div className="border-t border-[--border]" />
                <button
                  onClick={() => { setOpen(false); commitStatus(null, null) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[--destructive] hover:bg-[--secondary] transition-colors"
                >
                  Retirer de ma bibliothèque
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
