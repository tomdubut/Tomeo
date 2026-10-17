"use client"

import { useState, useTransition } from "react"
import { Check, ChevronDown, Library, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { addNewVolume, clearCollection, setVolumeStatus, setVolumesOwnedUpTo, type VolumeStatus } from "@/app/(main)/manga/actions"
import { MAX_VOLUMES_AHEAD } from "@/lib/manga/volumes"

interface Props {
  mangaId: string
  /** Volumes published in French (falls back to the known total) */
  totalVolumes: number | null
  volumesRead: number
  initialVolumes: Record<number, VolumeStatus>
  /** No more volumes will come out (the French count has reached the final Japanese count) */
  isComplete: boolean
}

const NEXT_STATUS: Record<"missing" | VolumeStatus, VolumeStatus | null> = {
  missing: "owned",
  owned: "ordered",
  ordered: null,
}

/** Grid of a series' volumes: tap to cycle missing → owned → ordered → missing. */
export default function MangaCollection({ mangaId, totalVolumes, volumesRead, initialVolumes, isComplete }: Props) {
  const [volumes, setVolumes] = useState<Record<number, VolumeStatus>>(initialVolumes)
  const [open, setOpen] = useState(Object.keys(initialVolumes).length > 0)
  // Folded when the page loads, so the grid doesn't push the rest of the page down
  const [collapsed, setCollapsed] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const [upTo, setUpTo] = useState("")
  const [, startTransition] = useTransition()

  const toggleCollapsed = () => setCollapsed((c) => !c)

  const highestHeld = Math.max(0, ...Object.keys(volumes).map(Number))
  const count = Math.max(totalVolumes ?? 0, highestHeld)
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

  function ownUpTo(requested: number) {
    // Not past the series' last volume (unless its count is unknown)
    const n = count > 0 ? Math.min(requested, count) : requested
    if (n < 1) return
    const next = { ...volumes }
    for (let i = 1; i <= n; i++) next[i] = "owned"
    apply(next, () => setVolumesOwnedUpTo(mangaId, n))
    setUpTo("")
  }

  function clearAll() {
    setConfirmClear(false)
    apply({}, () => clearCollection(mangaId))
  }

  function addNext() {
    const n = count + 1
    apply({ ...volumes, [n]: "owned" }, () => addNewVolume(mangaId, n))
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true)
          setCollapsed(false) // just started collecting: show the grid to fill in
        }}
        className="w-full sm:w-auto"
      >
        <Library className="h-4 w-4" />
        Je collectionne cette série
      </Button>
    )
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card sm:p-6">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 text-left"
      >
        <span className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold">Ma collection</h2>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", !collapsed && "rotate-180")} />
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{owned}</span>
          {count > 0 && ` / ${count}`} tome{Math.max(owned, count) > 1 ? "s" : ""}
          {ordered > 0 && ` · ${ordered} commandé${ordered > 1 ? "s" : ""}`}
          {collapsed && nextToBuy.length > 0 && owned > 0 && <span className="text-primary"> · prochain : {nextToBuy[0]}</span>}
        </span>
      </button>

      {!collapsed && (
        <>
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
            {Object.keys(volumes).length > 0 &&
              (confirmClear ? (
                <span className="flex items-center gap-1 text-sm">
                  <span className="font-medium">Tout retirer ?</span>
                  <Button size="sm" variant="destructive" onClick={clearAll}>Oui</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Annuler</Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} className="text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                  Tout retirer
                </Button>
              ))}
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
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary" /> Possédé</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-dashed border-accent" /> Commandé</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-secondary" /> Manquant</span>
            {volumesRead > 0 && <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-secondary-accent" /> Lu</span>}
            <span>· Touchez un tome pour changer son état</span>
          </div>

          {!isComplete && (!totalVolumes || count < totalVolumes + MAX_VOLUMES_AHEAD) && (
            <button
              type="button"
              onClick={addNext}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              <Plus className="h-4 w-4" />
              {count === 0 ? "Ajouter le tome 1" : `Le tome ${count + 1} est sorti ? Je l’ai`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
