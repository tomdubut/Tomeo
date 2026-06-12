"use client"

import { useState, useTransition } from "react"
import { setReadingStatus } from "@/app/(main)/books/actions"
import { Button } from "@/components/ui/button"
import { Check, ChevronDown, BookOpen, BookMarked, BookCheck } from "lucide-react"
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
}

export default function AddToLibraryButton({ bookId, initialStatus }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function choose(next: Status) {
    setOpen(false)
    startTransition(async () => {
      await setReadingStatus(bookId, next)
      setStatus(next)
    })
  }

  const current = status ? STATUS_LABELS[status] : null

  return (
    <div className="relative inline-block">
      <div className="flex">
        <Button
          onClick={() => !status && choose("want_to_read")}
          disabled={isPending}
          variant={status ? "secondary" : "default"}
          className="rounded-r-none pr-3 gap-2"
        >
          {current ? (
            <>
              {current.icon}
              {current.label}
              <Check className="h-3.5 w-3.5 ml-0.5" />
            </>
          ) : (
            "Ajouter à ma bibliothèque"
          )}
        </Button>
        <Button
          onClick={() => setOpen((o) => !o)}
          disabled={isPending}
          variant={status ? "secondary" : "default"}
          className="rounded-l-none border-l border-[--border] px-2"
          aria-label="Choisir un statut"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-[--border] bg-[--card] shadow-md overflow-hidden">
            {(Object.entries(STATUS_LABELS) as [NonNullable<Status>, typeof STATUS_LABELS[keyof typeof STATUS_LABELS]][]).map(
              ([key, { label, icon }]) => (
                <button
                  key={key}
                  onClick={() => choose(key)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[--secondary] transition-colors",
                    status === key && "font-medium"
                  )}
                >
                  {icon}
                  {label}
                  {status === key && <Check className="ml-auto h-3.5 w-3.5" />}
                </button>
              )
            )}
            {status && (
              <>
                <div className="border-t border-[--border]" />
                <button
                  onClick={() => choose(null)}
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
