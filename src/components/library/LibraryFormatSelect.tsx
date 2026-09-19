"use client"

import { LayoutGrid } from "lucide-react"

interface Format {
  id: number
  slug: string
  label: string
}

interface Props {
  username: string
  shelf: string
  sort: string
  format: string
  genres: string[]
  search: string
  formatList: Format[]
}

export default function LibraryFormatSelect({ username, shelf, sort, format, genres, search, formatList }: Props) {
  function buildHref(nextFormat: string) {
    const p = new URLSearchParams()
    if (shelf !== "all") p.set("shelf", shelf)
    if (sort !== "recent") p.set("sort", sort)
    if (nextFormat) p.set("format", nextFormat)
    if (genres.length) p.set("genres", genres.join(","))
    if (search) p.set("search", search)
    const qs = p.toString()
    return `/users/${username}/library${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="relative">
      <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[--muted-foreground] pointer-events-none" />
      <select
        value={format}
        onChange={(e) => window.location.assign(buildHref(e.target.value))}
        className="appearance-none rounded-lg bg-[--secondary] pl-8 pr-3 py-1.5 text-sm font-semibold text-[--foreground] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] whitespace-nowrap"
      >
        <option value="">Format</option>
        {formatList.map((f) => (
          <option key={f.id} value={f.slug}>{f.label}</option>
        ))}
      </select>
    </div>
  )
}
