"use client"

import { useState, useRef, useEffect } from "react"
import { Tag, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface Genre {
  id: number
  slug: string
  label: string
}

interface Props {
  username: string
  shelf: string
  sort: string
  format: string
  activeGenres: string[]
  search: string
  genreList: Genre[]
}

export default function LibraryGenreSelect({ username, shelf, sort, format, activeGenres, search, genreList }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string[]>(activeGenres)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPending(activeGenres)
  }, [activeGenres.join(",")])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        apply(pending)
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open, pending])

  function buildHref(genres: string[]) {
    const p = new URLSearchParams()
    if (shelf !== "all") p.set("shelf", shelf)
    if (sort !== "recent") p.set("sort", sort)
    if (format) p.set("format", format)
    if (genres.length) p.set("genres", genres.join(","))
    if (search) p.set("search", search)
    const qs = p.toString()
    return `/users/${username}/library${qs ? `?${qs}` : ""}`
  }

  function toggle(slug: string) {
    setPending((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug])
  }

  function apply(genres: string[]) {
    const current = [...activeGenres].sort().join(",")
    const next = [...genres].sort().join(",")
    if (current !== next) window.location.assign(buildHref(genres))
  }

  const label = pending.length === 0 ? "Genres" : pending.length === 1
    ? (genreList.find((g) => g.slug === pending[0])?.label ?? "1 genre")
    : `${pending.length} genres`

  return (
    <div ref={ref} className="relative shrink-0">
      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[--muted-foreground] pointer-events-none" />
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "appearance-none rounded-lg bg-[--secondary] pl-8 pr-7 py-1.5 text-sm font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] whitespace-nowrap",
          pending.length > 0 ? "text-[--primary]" : "text-[--foreground]"
        )}
      >
        {label}
      </button>
      <ChevronDown className={cn("absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[--muted-foreground] pointer-events-none transition-transform", open && "rotate-180")} />

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] max-h-64 overflow-y-auto rounded-xl border border-[--border] bg-[--card] shadow-lg py-1">
          {genreList.map((g) => {
            const checked = pending.includes(g.slug)
            return (
              <label
                key={g.id}
                className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-[--secondary] select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(g.slug)}
                  className="accent-[--primary] h-3.5 w-3.5 shrink-0"
                />
                {g.label}
              </label>
            )
          })}
          <div className="sticky bottom-0 border-t border-[--border] bg-[--card] px-3 py-2 flex gap-2">
            {pending.length > 0 && (
              <button
                onClick={() => { setPending([]); apply([]) }}
                className="text-xs text-[--muted-foreground] hover:text-[--foreground]"
              >
                Effacer
              </button>
            )}
            <button
              onClick={() => { apply(pending); setOpen(false) }}
              className="ml-auto rounded-lg bg-[--primary] px-3 py-1 text-xs font-semibold text-white"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
