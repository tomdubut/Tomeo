"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { importBook } from "@/app/(main)/books/actions"
import { Loader2, Hash } from "lucide-react"

const ISBN_RE = /^(?:\d{9}[\dX]|\d{13})$/

function normaliseIsbn(raw: string) {
  return raw.replace(/[\s-]/g, "")
}

interface Props {
  variant?: "inline" | "empty-state"
}

export default function IsbnImport({ variant = "inline" }: Props) {
  const [expanded, setExpanded] = useState(variant === "empty-state")
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const isbn = normaliseIsbn(value)
    if (!ISBN_RE.test(isbn)) {
      setError("ISBN invalide — 10 ou 13 chiffres attendus.")
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const { id } = await importBook(isbn)
        router.push(`/books/${id}`)
      } catch {
        setError("Livre introuvable pour cet ISBN.")
      }
    })
  }

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-start gap-2">
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
          >
            <Hash className="h-3.5 w-3.5" />
            Rechercher par ISBN
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-sm">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-[--border] bg-[--secondary] px-3 py-2">
              <Hash className="h-3.5 w-3.5 shrink-0 text-[--muted-foreground]" />
              <input
                autoFocus
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null) }}
                placeholder="9782070360024"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[--muted-foreground]"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !value.trim()}
              className="rounded-xl bg-[--primary] px-3 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
            </button>
            <button
              type="button"
              onClick={() => { setExpanded(false); setValue(""); setError(null) }}
              className="text-xs text-[--muted-foreground] hover:text-[--foreground]"
            >
              Annuler
            </button>
          </form>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // empty-state variant
  return (
    <div className="mt-4 border-t border-[--border] pt-4">
      <p className="text-sm text-[--muted-foreground] mb-3">Vous connaissez l&apos;ISBN ?</p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[--border] bg-[--secondary] px-3 py-2">
          <Hash className="h-3.5 w-3.5 shrink-0 text-[--muted-foreground]" />
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
            placeholder="9782070360024"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[--muted-foreground]"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !value.trim()}
          className="rounded-xl bg-[--primary] px-3 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importer"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
