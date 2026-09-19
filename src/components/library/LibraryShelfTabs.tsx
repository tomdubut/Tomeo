"use client"

import { cn } from "@/lib/utils"

const SHELVES = [
  { key: "all", label: "Tous" },
  { key: "read", label: "Lus" },
  { key: "currently_reading", label: "En cours" },
  { key: "want_to_read", label: "À lire" },
] as const

type ShelfKey = typeof SHELVES[number]["key"]

interface Props {
  username: string
  activeShelf: ShelfKey
  sort: string
  format: string
  genres: string[]
  search: string
  countByShelf: Record<string, number>
  totalCount: number
}

function buildHref(username: string, shelf: ShelfKey, sort: string, format: string, genres: string[], search: string) {
  const params = new URLSearchParams()
  if (shelf !== "all") params.set("shelf", shelf)
  if (sort && sort !== "recent") params.set("sort", sort)
  if (format) params.set("format", format)
  if (genres.length) params.set("genres", genres.join(","))
  if (search) params.set("search", search)
  const qs = params.toString()
  return `/users/${username}/library${qs ? `?${qs}` : ""}`
}

export default function LibraryShelfTabs({ username, activeShelf, sort, format, genres, search, countByShelf, totalCount }: Props) {
  return (
    <div className="flex gap-1 rounded-2xl bg-[--secondary] p-1">
      {SHELVES.map(({ key, label }) => {
        const count = key === "all" ? totalCount : (countByShelf[key] ?? 0)
        return (
          <button
            key={key}
            onClick={() => window.location.assign(buildHref(username, key, sort, format, genres, search))}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
              activeShelf === key ? "text-white" : "text-[--muted-foreground] hover:text-[--foreground]"
            )}
            style={activeShelf === key ? { background: "var(--primary)" } : {}}
          >
            {label}
            {count > 0 && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-semibold", activeShelf === key ? "bg-white/25 text-white" : "bg-[--border] text-[--muted-foreground]")}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
