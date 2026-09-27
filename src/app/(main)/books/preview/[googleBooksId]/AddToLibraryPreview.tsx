"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { importAndSetStatus } from "@/app/(main)/books/actions"
import { BookMarked, BookOpen, BookCheck, ChevronDown, Loader2 } from "lucide-react"

type Status = "want_to_read" | "currently_reading" | "read"

const STATUS_OPTIONS: { key: Status; label: string; icon: React.ReactNode }[] = [
  { key: "want_to_read",      label: "À lire",   icon: <BookMarked className="h-4 w-4" /> },
  { key: "currently_reading", label: "En cours", icon: <BookOpen className="h-4 w-4" /> },
  { key: "read",              label: "Lu",        icon: <BookCheck className="h-4 w-4" /> },
]

export default function AddToLibraryPreview({ googleBooksId }: { googleBooksId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function choose(status: Status) {
    setOpen(false)
    startTransition(async () => {
      const { id } = await importAndSetStatus(googleBooksId, status)
      router.replace(`/books/${id}`)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150"
        style={{ background: "var(--secondary)", color: "var(--foreground)" }}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <BookMarked className="h-4 w-4 shrink-0" />}
        Ma bibliothèque
        <ChevronDown className="h-4 w-4 shrink-0 ml-auto" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-2 z-50 w-48 rounded-2xl p-1.5"
            style={{
              background: "var(--card)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            {STATUS_OPTIONS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => choose(key)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors text-left hover:bg-[--secondary]"
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
