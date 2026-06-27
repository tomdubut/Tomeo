"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { setReadingStatus } from "@/app/(main)/books/actions"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Status = "want_to_read" | "currently_reading" | "read"

const STATUS_OPTIONS: { key: Status; label: string }[] = [
  { key: "read", label: "Lu" },
  { key: "currently_reading", label: "En cours" },
  { key: "want_to_read", label: "À lire" },
]

interface Props {
  bookId: string
  onClose: () => void
}

export default function StatusPickerModal({ bookId, onClose }: Props) {
  const [status, setStatus] = useState<Status>("read")
  const [finishedAt, setFinishedAt] = useState(new Date().toISOString().slice(0, 10))
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function confirm() {
    startTransition(async () => {
      await setReadingStatus(bookId, status, status === "read" ? finishedAt : null)
      router.refresh()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ajouter à votre bibliothèque</h2>
          <button onClick={onClose} className="text-[--muted-foreground] hover:text-[--foreground]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatus(opt.key)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors"
              style={{
                background: status === opt.key ? "var(--primary)" : "var(--secondary)",
                color: status === opt.key ? "#fff" : "var(--foreground)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {status === "read" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Date de fin de lecture</p>
            <input
              type="date"
              value={finishedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFinishedAt(e.target.value)}
              style={{ fontSize: "16px" }}
              className="w-full rounded-xl bg-[--secondary] px-4 py-2.5 text-sm font-medium focus:outline-none"
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Passer
          </Button>
          <Button onClick={confirm} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
          </Button>
        </div>
      </div>
    </div>
  )
}
