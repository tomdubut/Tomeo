"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Pencil, Check, X, Target } from "lucide-react"
import { updateReadingGoal } from "@/app/(main)/home/actions"

interface Props {
  currentGoal: number | null
  booksRead: number
  year: number
}

export default function ReadingGoalWidget({ currentGoal, booksRead, year }: Props) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(String(currentGoal ?? ""))
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function save() {
    const parsed = parseInt(inputValue)
    if (!inputValue || isNaN(parsed) || parsed < 1) {
      cancel()
      return
    }
    startTransition(async () => {
      await updateReadingGoal(parsed)
      setEditing(false)
    })
  }

  function cancel() {
    setInputValue(String(currentGoal ?? ""))
    setEditing(false)
  }

  function remove() {
    startTransition(async () => {
      await updateReadingGoal(null)
      setInputValue("")
      setEditing(false)
    })
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") save()
    if (e.key === "Escape") cancel()
  }

  // No goal set yet
  if (!currentGoal && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
        style={{ background: "var(--card)", color: "var(--muted-foreground)" }}
      >
        <Target className="h-4 w-4" />
        Définir un objectif {year}
      </button>
    )
  }

  // Editing mode
  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm" style={{ background: "var(--card)" }}>
        <Target className="h-4 w-4 shrink-0 text-[--muted-foreground]" />
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={999}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ex: 24"
          className="w-16 bg-transparent text-sm font-semibold outline-none"
          style={{ color: "var(--foreground)" }}
        />
        <span className="text-xs text-[--muted-foreground] shrink-0">livres en {year}</span>
        <button onClick={save} disabled={isPending} className="rounded-full p-1 hover:bg-[--secondary] transition-colors">
          <Check className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
        </button>
        <button onClick={cancel} className="rounded-full p-1 hover:bg-[--secondary] transition-colors">
          <X className="h-3.5 w-3.5 text-[--muted-foreground]" />
        </button>
        {currentGoal && (
          <button onClick={remove} disabled={isPending} className="text-xs text-[--muted-foreground] hover:text-[--destructive] transition-colors px-1">
            Supprimer
          </button>
        )}
      </div>
    )
  }

  // Goal set — show progress bar
  const goal = currentGoal!
  const pct = Math.min(100, Math.round((booksRead / goal) * 100))
  const remaining = Math.max(0, goal - booksRead)
  const done = booksRead >= goal

  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--card)" }}>
      <Target className="h-4 w-4 shrink-0" style={{ color: done ? "var(--primary)" : "var(--muted-foreground)" }} />

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm">
            {done
              ? `Objectif ${year} atteint ! 🎉`
              : `Objectif ${year}`}
          </span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            {booksRead} / {currentGoal}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: done ? "var(--primary)" : "var(--foreground)" }}
          />
        </div>

        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {done
            ? `Vous avez lu ${booksRead} livre${booksRead > 1 ? "s" : ""} cette année`
            : `${remaining} livre${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""} · ${pct}%`}
        </p>
      </div>

      <button
        onClick={() => { setInputValue(String(currentGoal)); setEditing(true) }}
        className="shrink-0 rounded-full p-1.5 hover:bg-[--secondary] transition-colors"
      >
        <Pencil className="h-3.5 w-3.5 text-[--muted-foreground]" />
      </button>
    </div>
  )
}
