"use client"

import { ArrowUpDown } from "lucide-react"

const SORT_OPTIONS = [
  { key: "recent", label: "Ajout récent" },
  { key: "date_read_desc", label: "Lu récemment" },
  { key: "date_read_asc", label: "Lu il y a longtemps" },
  { key: "rating_desc", label: "Meilleures notes" },
  { key: "rating_asc", label: "Moins bonnes notes" },
] as const

interface Props {
  username: string
  shelf: string
  sort: string
  format: string
  genres: string[]
  search: string
}

export default function LibrarySortSelect({ username, shelf, sort, format, genres, search }: Props) {
  function buildHref(nextSort: string) {
    const p = new URLSearchParams()
    if (shelf !== "all") p.set("shelf", shelf)
    if (nextSort !== "recent") p.set("sort", nextSort)
    if (format) p.set("format", format)
    if (genres.length) p.set("genres", genres.join(","))
    if (search) p.set("search", search)
    const qs = p.toString()
    return `/users/${username}/library${qs ? `?${qs}` : ""}`
  }

  const options = SORT_OPTIONS.map((opt) => (
    <option key={opt.key} value={opt.key}>{opt.label}</option>
  ))

  return (
    <>
      {/* Mobile: icon-only button with invisible select overlay */}
      <div className="relative sm:hidden">
        <div className="flex items-center justify-center rounded-lg bg-[--secondary] w-8 h-[34px] pointer-events-none">
          <ArrowUpDown className="h-3.5 w-3.5 text-[--muted-foreground]" />
        </div>
        <select
          value={sort}
          onChange={(e) => window.location.assign(buildHref(e.target.value))}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        >
          {options}
        </select>
      </div>

      {/* Desktop: full select with label */}
      <div className="relative hidden sm:block">
        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[--muted-foreground] pointer-events-none" />
        <select
          value={sort}
          onChange={(e) => window.location.assign(buildHref(e.target.value))}
          className="appearance-none rounded-lg bg-[--secondary] pl-8 pr-3 py-1.5 text-sm font-semibold text-[--foreground] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
        >
          {options}
        </select>
      </div>
    </>
  )
}
