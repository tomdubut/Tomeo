"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { setReadingStatus } from "@/app/(main)/books/actions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, ChevronDown, BookOpen, BookMarked, BookCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcDropdownPos } from "@/lib/utils/dropdown"

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
    setDropdownPos(calcDropdownPos(chevronRef.current.getBoundingClientRect(), 208, 160))
    setShowDatePicker(false)
    setOpen(true)
  }

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    function update() {
      if (!chevronRef.current) return
      setDropdownPos(calcDropdownPos(chevronRef.current.getBoundingClientRect(), 208, 160))
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
      if (next === null) toast.success("Livre retiré de la bibliothèque")
      else if (next === "want_to_read") toast.success("Ajouté à « À lire »")
      else if (next === "currently_reading") toast.success("Ajouté à « En cours »")
      else if (next === "read") toast.success("Marqué comme lu ✓")
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
        <div className="rounded-2xl border border-[--border] p-4 space-y-3 w-full" style={{ background: "var(--background)" }}>
          <p className="text-sm font-semibold">Date de fin de lecture</p>
          <Input
            id="finished_at"
            type="date"
            value={finishedAt}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFinishedAt(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-[--muted-foreground]">Optionnel — modifiable plus tard.</p>
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

      <Button
        ref={chevronRef}
        onClick={openDropdown}
        disabled={isPending}
        variant={status ? "secondary" : "default"}
        className="w-full sm:w-auto gap-2 justify-between sm:justify-center"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : current ? (
          <><span className="flex items-center gap-2">{current.icon}{current.label}<Check className="h-3.5 w-3.5" /></span></>
        ) : (
          <span>Ajouter à ma bibliothèque</span>
        )}
        <ChevronDown className={cn("h-4 w-4 transition-transform shrink-0", open && "rotate-180")} />
      </Button>

      {open && dropdownPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-52 rounded-2xl border border-[--border] overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left, background: "var(--background)", boxShadow: "var(--shadow-lg)" }}
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
