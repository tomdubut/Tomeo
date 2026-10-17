"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Row of status pills (Nouveau · Prévu · Fait · Ignoré); saves through the given server action. */
export default function StatusButtons({
  id,
  status,
  options,
  save,
}: {
  id: string
  status: string
  options: { value: string; label: string }[]
  save: (id: string, status: string) => Promise<{ error?: string }>
}) {
  const [current, setCurrent] = useState(status)
  const [isPending, startTransition] = useTransition()

  function choose(value: string) {
    if (value === current) return
    const previous = current
    setCurrent(value)
    startTransition(async () => {
      const { error } = await save(id, value)
      if (error) {
        setCurrent(previous)
        toast.error(error)
      }
    })
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", isPending && "opacity-70")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          aria-pressed={current === o.value}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
            current === o.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
