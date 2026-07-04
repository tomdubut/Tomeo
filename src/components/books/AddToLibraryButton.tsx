"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { setReadingStatus } from "@/app/(main)/books/actions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Check, ChevronDown, BookOpen, BookMarked, BookCheck, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcDropdownPos } from "@/lib/utils/dropdown"
import PostReadModal from "@/components/reviews/PostReadModal"

type Status = "want_to_read" | "currently_reading" | "read" | null

const STATUS_OPTIONS: { key: NonNullable<Status>; label: string; icon: React.ReactNode }[] = [
  { key: "want_to_read",      label: "À lire",   icon: <BookMarked className="h-4 w-4" /> },
  { key: "currently_reading", label: "En cours", icon: <BookOpen className="h-4 w-4" /> },
  { key: "read",              label: "Lu",        icon: <BookCheck className="h-4 w-4" /> },
]

interface Props {
  bookId: string
  initialStatus: Status
  initialFinishedAt?: string | null
  hasReview?: boolean
  hasRating?: boolean
  existingScore?: number | null
}

export default function AddToLibraryButton({ bookId, initialStatus, initialFinishedAt, hasReview, hasRating, existingScore }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus)
  useEffect(() => { setStatus(initialStatus) }, [initialStatus])
  const [open, setOpen] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showPostReadModal, setShowPostReadModal] = useState(false)
  const [finishedAt, setFinishedAt] = useState<string>(
    initialFinishedAt ?? new Date().toISOString().slice(0, 10)
  )
  const [savedFinishedAt, setSavedFinishedAt] = useState<string | null>(initialFinishedAt ?? null)
  useEffect(() => { setSavedFinishedAt(initialFinishedAt ?? null) }, [initialFinishedAt])
  const [isPending, startTransition] = useTransition()
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function openDropdown() {
    if (!btnRef.current) return
    setDropdownPos(calcDropdownPos(btnRef.current.getBoundingClientRect(), 220, 168))
    setShowDatePicker(false)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function update() {
      if (!btnRef.current) return
      setDropdownPos(calcDropdownPos(btnRef.current.getBoundingClientRect(), 220, 168))
    }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [open])

  function choose(next: NonNullable<Status>) {
    setOpen(false)
    if (next === "read") { setShowDatePicker(true); return }
    commitStatus(next, null)
  }

  function commitStatus(next: Status, date: string | null) {
    startTransition(async () => {
      await setReadingStatus(bookId, next, date)
      setStatus(next)
      setSavedFinishedAt(date)
      if (next === null) toast.success("Livre retiré de la bibliothèque")
      else if (next === "want_to_read") toast.success("Ajouté à « À lire »")
      else if (next === "currently_reading") toast.success("Ajouté à « En cours »")
      else if (next === "read") {
        toast.success("Marqué comme lu ✓")
        if (!hasReview || !hasRating) setShowPostReadModal(true)
      }
    })
  }

  function confirmRead() {
    setShowDatePicker(false)
    commitStatus("read", finishedAt)
  }

  const current = status ? STATUS_OPTIONS.find(o => o.key === status) : null

  return (
    <div className="space-y-3">
      {showPostReadModal && (
        <PostReadModal
          bookId={bookId}
          hasRating={hasRating ?? false}
          hasReview={hasReview ?? false}
          existingScore={existingScore ?? null}
          onClose={() => setShowPostReadModal(false)}
        />
      )}

      {showDatePicker && (
        <div className="space-y-3 w-full py-2">
          <p className="text-sm font-semibold">Date de fin de lecture</p>
          <input
            type="date"
            value={finishedAt}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFinishedAt(e.target.value)}
            style={{ fontSize: "16px" }}
            className="w-full rounded-xl bg-[--secondary] px-4 py-2.5 text-sm font-medium focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={confirmRead} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
              </Button>
              <button
                onClick={() => { setShowDatePicker(false); commitStatus("read", null) }}
                className="text-sm text-[--muted-foreground] hover:text-[--foreground] underline underline-offset-2"
              >
                Passer
              </button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowDatePicker(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {status === "read" && savedFinishedAt && !showDatePicker && (
        <p className="text-xs text-[--muted-foreground]">
          Terminé le{" "}
          <button
            className="underline underline-offset-2 hover:text-[--foreground]"
            onClick={() => setShowDatePicker(true)}
          >
            {new Date(savedFinishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </button>
        </p>
      )}

      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={openDropdown}
        disabled={isPending}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
          current
            ? "bg-[--foreground] text-[--background]"
            : "border border-[--border] bg-[--card] hover:bg-[--secondary]"
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : current ? (
          <>{current.icon}{current.label}<Check className="h-3.5 w-3.5 shrink-0" /></>
        ) : (
          <><BookMarked className="h-4 w-4 shrink-0" />Ma bibliothèque</>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 ml-auto transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && dropdownPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-56 rounded-2xl border border-[--border] p-1.5"
            style={{ top: dropdownPos.top, left: dropdownPos.left, background: "var(--card)", boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)" }}
          >
            {STATUS_OPTIONS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => choose(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors text-left",
                  status === key
                    ? "bg-[--foreground] text-[--background] font-semibold"
                    : "hover:bg-[--secondary] font-medium"
                )}
              >
                {icon}
                {label}
                {status === key && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}

            {status && (
              <button
                onClick={() => { setOpen(false); commitStatus(null, null) }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[--secondary]"
                style={{ color: "var(--destructive)" }}
              >
                <X className="h-4 w-4 shrink-0" />
                Retirer de la bibliothèque
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
