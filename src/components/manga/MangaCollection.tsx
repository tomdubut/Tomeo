"use client"

import { useState, useTransition } from "react"
import { Check, Library, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { setVolumeStatus, setVolumesOwnedUpTo, type VolumeStatus } from "@/app/(main)/manga/actions"

interface Props {
  mangaId: string
  /** Volumes published in French (falls back to the known total) */
  totalVolumes: number | null
  volumesRead: number
  initialVolumes: Record<number, VolumeStatus>
}

const NEXT_STATUS: Record<"missing" | VolumeStatus, VolumeStatus | null> = {
  missing: "owned",
  owned: "ordered",
  ordered: null,
}

/** Grid of a series' volumes: tap to cycle missing → owned → ordered → missing. */
export default function MangaCollection({ mangaId, totalVolumes, volumesRead, initialVolumes }: Props) {
  const [volumes, setVolumes] = useState<Record<number, VolumeStatus>>(initialVolumes)
  const [open, setOpen] = useState(Object.keys(initialVolumes).length > 0)
  const [extra, setExtra] = useState(0)
  const [upTo, setUpTo] = useState("")
  const [, startTransition] = useTransition()

  const highestHeld = Math.max(0, ...Object.keys(volumes).map(Number))
  const count = Math.max(totalVolumes ?? 0, highestHeld) + extra
  const numbers = Array.from({ length: count }, (_, i) => i + 1)
  const owned = numbers.filter((n) => volumes[n] === "owned").length
  const ordered = numbers.filter((n) => volumes[n] === "ordered").length
  const nextToBuy = numbers.filter((n) => !volumes[n]).slice(0, 3)

  function apply(next: Record<number, VolumeStatus>, save: () => Promise<{ error?: string }>) {
    const previous = volumes
    setVolumes(next)
    startTransition(async () => {
      const { error } = await save()
      if (error) {
        setVolumes(previous)
        toast.error(error)
      }
    })
  }

  function cycle(n: number) {
    const status = NEXT_STATUS[volumes[n] ?? "missing"]
    const next = { ...volumes }
    if (status) next[n] = status
    else delete next[n]
    apply(next, () => setVolumeStatus(mangaId, n, status))
  }

  function ownUpTo(n: number) {
    if (n < 1) return
    const next = { ...volumes }
    for (let i = 1; i <= n; i++) next[i] = "owned"
    apply(next, () => setVolumesOwnedUpTo(mangaId, n))
    setUpTo("")
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Library className="h-4 w-4" />
        Je collectionne cette série
      </Button>
    )
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold">Ma collection</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{owned}</span>
          {count > 0 && ` / ${count}`} tome{Math.max(owned, count) > 1 ? "s" : ""}
          {ordered > 0 && ` · ${ordered} commandé${ordered > 1 ? "s" : ""}`}
        </p>
      </div>

      {count > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(owned / count) * 100}%` }} />
        </div>
      )}

      {nextToBuy.length > 0 && owned > 0 && (
        <p className="mt-3 text-sm font-medium text-primary">
          Prochains achats : {nextToBuy.join(", ")}
          {numbers.filter((n) => !volumes[n]).length > nextToBuy.length && "…"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {count > 0 && owned < count && (
          <Button size="sm" onClick={() => ownUpTo(count)}>
            <Check className="h-3.5 w-3.5" />
            Tout posséder
          </Button>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            ownUpTo(Math.min(parseInt(upTo, 10) || 0, 1000))
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={upTo}
            onChange={(e) => setUpTo(e.target.value)}
            placeholder="N° du tome"
            aria-label="Posséder jusqu'au tome"
            className="h-8 w-32 rounded-lg border border-input bg-card px-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          />
          <Button size="sm" variant="outline" type="submit" disabled={!upTo}>
            Posséder jusqu’à
          </Button>
        </form>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10">
        {numbers.map((n) => {
          const status = volumes[n]
          const read = n <= volumesRead
          return (
            <button
              key={n}
              type="button"
              onClick={() => cycle(n)}
              aria-label={`Tome ${n} : ${status === "owned" ? "possédé" : status === "ordered" ? "commandé" : "manquant"}${read ? ", lu" : ""}`}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-sm font-bold tabular-nums transition-colors",
                status === "owned" && "bg-primary text-primary-foreground",
                status === "ordered" && "border-2 border-dashed border-accent bg-accent/15 text-foreground",
                !status && "bg-secondary text-muted-foreground hover:bg-muted"
              )}
            >
              {n}
              {read && (
                <span
                  aria-hidden
                  className={cn("absolute bottom-1 h-1 w-1 rounded-full", status === "owned" ? "bg-primary-foreground" : "bg-secondary-accent")}
                />
              )}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setExtra((x) => x + 1)}
          aria-label="Ajouter un tome"
          className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-secondary"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary" /> Possédé</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-dashed border-accent" /> Commandé</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-secondary" /> Manquant</span>
        {volumesRead > 0 && <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-secondary-accent" /> Lu</span>}
        <span>· Touchez un tome pour changer son état</span>
      </div>
    </section>
  )
}
