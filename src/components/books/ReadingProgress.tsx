"use client"

import { useState, useRef } from "react"
import { updateReadingProgress } from "@/app/(main)/books/actions"

interface Props {
  bookId: string
  pageCount: number | null
  currentPage: number | null
}

export default function ReadingProgress({ bookId, pageCount, currentPage: initial }: Props) {
  const [current, setCurrent] = useState(initial ?? 0)
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const percent = pageCount
    ? Math.min(100, Math.round((current / pageCount) * 100))
    : Math.min(100, current)

  function startEdit() {
    setInputValue(current > 0 ? String(current) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }

  async function commit(raw: string) {
    setEditing(false)
    const num = parseInt(raw)
    if (isNaN(num) || num < 0) return
    const clamped = pageCount ? Math.min(num, pageCount) : Math.min(num, 100)
    setCurrent(clamped)
    await updateReadingProgress(bookId, clamped)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[--muted-foreground]">Progression</span>

        <span className="text-[--muted-foreground]">
          {pageCount ? (
            editing ? (
              <span className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={(e) => commit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(inputValue)
                    if (e.key === "Escape") setEditing(false)
                  }}
                  min={0}
                  max={pageCount}
                  className="w-14 rounded-lg border border-[--border] bg-[--secondary] px-2 py-0.5 text-right text-sm outline-none focus:border-[--primary]"
                />
                <span>/ {pageCount} p.</span>
              </span>
            ) : (
              <button onClick={startEdit} className="tabular-nums hover:underline" title="Modifier">
                {current > 0 ? `${current} / ${pageCount} p.` : `— / ${pageCount} p.`}
              </button>
            )
          ) : (
            editing ? (
              <span className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={(e) => commit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(inputValue)
                    if (e.key === "Escape") setEditing(false)
                  }}
                  min={0}
                  max={100}
                  className="w-14 rounded-lg border border-[--border] bg-[--secondary] px-2 py-0.5 text-right text-sm outline-none focus:border-[--primary]"
                />
                <span>%</span>
              </span>
            ) : (
              <button onClick={startEdit} className="tabular-nums hover:underline" title="Modifier">
                {current > 0 ? `${current}%` : "—"}
              </button>
            )
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[--secondary]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, background: "var(--primary)" }}
        />
      </div>

      {current === 0 && (
        <p className="text-xs text-[--muted-foreground]">
          {pageCount ? "Tapez le numéro de page pour suivre votre avancement." : "Entrez votre pourcentage d'avancement."}
        </p>
      )}
    </div>
  )
}
